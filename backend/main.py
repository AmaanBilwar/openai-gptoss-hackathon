import argparse
import json
import os
import sys
import time
import webbrowser
import re
import subprocess
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv
import requests

load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_ME_URL = "https://api.github.com/user"


def _print_err(message: str) -> None:
    print(message, file=sys.stderr)


def _request_json(method: str, url: str, **kwargs) -> dict:
    headers = kwargs.pop("headers", {})
    headers.setdefault("Accept", "application/json")
    response = requests.request(method, url, headers=headers, **kwargs)
    response.raise_for_status()
    return response.json()


@dataclass
class DeviceCodeResponse:
    device_code: str
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


# token store
class TokenStore:
    """Persist access token using OS keyring when available, else a file in the home directory."""

    def __init__(self, service_name: str = "gh_oauth_cli", filename: str = ".gh_oauth_token"):
        self.service_name = service_name
        self.filename = os.path.join(os.path.expanduser("~"), filename)
        try:
            import keyring  # type: ignore

            self._keyring = keyring
        except Exception:
            self._keyring = None

    def save(self, token: str) -> None:
        if self._keyring is not None:
            self._keyring.set_password(self.service_name, "token", token)
            return
        # Fallback to file storage
        with open(self.filename, "w", encoding="utf-8") as f:
            json.dump({"access_token": token}, f)

    def load(self) -> Optional[str]:
        if self._keyring is not None:
            try:
                token = self._keyring.get_password(self.service_name, "token")
                return token
            except Exception:
                return None
        if not os.path.exists(self.filename):
            return None
        try:
            with open(self.filename, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("access_token")
        except Exception:
            return None

    def delete(self) -> None:
        if self._keyring is not None:
            try:
                self._keyring.delete_password(self.service_name, "token")
                return
            except Exception:
                pass
        try:
            if os.path.exists(self.filename):
                os.remove(self.filename)
        except Exception:
            pass

# start device code flow
def start_device_code_flow(client_id: str, scope: str) -> DeviceCodeResponse:
    data = {"client_id": client_id, "scope": scope}
    payload = _request_json("POST", GITHUB_DEVICE_CODE_URL, data=data)
    # GitHub returns: device_code, user_code, verification_uri, expires_in, interval
    return DeviceCodeResponse(
        device_code=payload["device_code"],
        user_code=payload["user_code"],
        verification_uri=payload["verification_uri"],
        expires_in=int(payload.get("expires_in", 900)),
        interval=int(payload.get("interval", 5)),
    )


# poll for access token
def poll_for_access_token(client_id: str, device_code: str, interval: int) -> str:
    data = {
        "client_id": client_id,
        "device_code": device_code,
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
    }
    current_interval = max(1, interval)
    deadline = time.time() + 15 * 60  # 15 minutes safety
    while True:
        if time.time() > deadline:
            raise TimeoutError("Timed out waiting for authorization")
        try:
            payload = _request_json("POST", GITHUB_ACCESS_TOKEN_URL, data=data)
        except requests.HTTPError as e:
            # For 400 errors, GitHub returns error in body as JSON; attempt to parse
            if e.response is not None and e.response.status_code == 400:
                try:
                    payload = e.response.json()
                except Exception:
                    raise
            else:
                raise

        if "access_token" in payload:
            return payload["access_token"]

        error = payload.get("error")
        if error == "authorization_pending":
            time.sleep(current_interval)
            continue
        if error == "slow_down":
            current_interval += 5
            time.sleep(current_interval)
            continue
        if error in {"expired_token", "access_denied", "unsupported_grant_type", "incorrect_client_credentials"}:
            raise RuntimeError(f"OAuth error: {error}")

        # Unexpected response
        raise RuntimeError(f"Unexpected token response: {payload}")


# login
def cmd_login(args: argparse.Namespace) -> None:
    client_id = GITHUB_CLIENT_ID
    client_secret = GITHUB_CLIENT_SECRET

    scope = args.scope
    store = TokenStore()

    print("Starting GitHub device authorization flow...")
    dc = start_device_code_flow(client_id=client_id, scope=scope)

    print()
    print("1) Open this URL in your browser:")
    print(f"   {dc.verification_uri}")
    print("2) Enter this one-time code:")
    print(f"   {dc.user_code}")
    print()

    if args.open:
        try:
            webbrowser.open(dc.verification_uri, new=2)
        except Exception:
            pass

    print("Waiting for you to authorize in the browser...")
    try:
        token = poll_for_access_token(client_id=client_id, device_code=dc.device_code, interval=dc.interval)
    except Exception as e:
        _print_err(str(e))
        sys.exit(1)

    store.save(token)
    print("Login successful. Access token saved.")


# whoami
def cmd_whoami(_args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }
    try:
        me = _request_json("GET", GITHUB_API_ME_URL, headers=headers)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 401:
            _print_err("Saved token is invalid or expired. Please login again.")
            sys.exit(1)
        raise

    # Display concise identity info
    login = me.get("login", "?")
    name = me.get("name") or ""
    user_id = me.get("id", "?")
    print(f"{login} {f'({name})' if name else ''} - id: {user_id}")


# logout
def cmd_logout(_args: argparse.Namespace) -> None:
    store = TokenStore()
    store.delete()
    print("Logged out locally (token removed).")

# list repos
def list_repos(_args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }
    response = requests.get("https://api.github.com/user/repos", headers=headers)
    response.raise_for_status()
    print(response.json())

# create pr 
def create_pr(args: argparse.Namespace) -> None:
    """Create a pull request using GitHub REST API.

    Required args:
      --owner, --repo, --title, --head, --base
    Optional args:
      --body, --draft, --no-maintainer-modify, --open
    """
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login --scope repo")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    title = args.title
    head = args.head
    base = args.base

    if not owner or not repo or not title or not head or not base:
        _print_err("Missing required arguments: --owner, --repo, --title, --head, --base")
        sys.exit(1)

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"

    body: dict = {
        "title": title,
        "head": head,
        "base": base,
    }
    if getattr(args, "body", None):
        body["body"] = args.body
    # maintainer_can_modify defaults to True on GitHub; respect flag to disable
    maintainer_can_modify = not getattr(args, "no_maintainer_modify", False)
    body["maintainer_can_modify"] = maintainer_can_modify
    if getattr(args, "draft", False):
        body["draft"] = True

    try:
        response = requests.post(url, headers=headers, json=body)
    except requests.RequestException as exc:
        _print_err(f"Request failed: {exc}")
        sys.exit(1)

    if response.status_code in {201}:
        pr = response.json()
        print(pr)
        ## Optionally open in browser
        # if getattr(args, "open", False):
        #     try:
        #         html_url = pr.get("html_url")
        #         if html_url:
        #             webbrowser.open(html_url, new=2)
        #     except Exception:
        #         pass
        # return

    try:
        payload = response.json()
        message = payload.get("message") or response.text
    except Exception:
        message = response.text
    _print_err(f"Failed to create PR: {response.status_code} - {message}")
    if response.status_code in {401, 403}:
        _print_err("Hint: Ensure your token has the 'repo' scope (or 'public_repo' for public repos). Re-run login with --scope repo if needed.")
    sys.exit(1)

# merge pr
def merge_pr(args: argparse.Namespace) -> None:
    """Merge a pull request using GitHub REST API.

    Required args:
      --owner, --repo, --pull-number
    Optional args:
      --commit-title, --commit-message, --sha, --merge-method
    """
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    pull_number = args.pull_number

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/merge"

    body: dict = {}
    if args.commit_title:
        body["commit_title"] = args.commit_title
    if args.commit_message:
        body["commit_message"] = args.commit_message
    if args.sha:
        body["sha"] = args.sha
    if args.merge_method:
        if args.merge_method not in {"merge", "squash", "rebase"}:
            _print_err("Invalid --merge-method. Must be one of: merge, squash, rebase")
            sys.exit(1)
        body["merge_method"] = args.merge_method

    response = requests.put(url, headers=headers, json=body)
    if response.status_code == 200:
        print(response.json())
        return
    try:
        payload = response.json()
        message = payload.get("message") or response.text
    except Exception:
        message = response.text
    _print_err(f"Failed to merge PR: {response.status_code} - {message}")
    sys.exit(1)

# create branch
def create_branch(args: argparse.Namespace) -> None:
    """Create a new branch in a GitHub repository."""
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    repo = args.repo
    new_branch = args.branch
    from_branch = args.from_branch

    try:
        if not from_branch:
            # If no base branch is specified, find the repo's default branch and checkout from there
            repo_details = _request_json("GET", f"https://api.github.com/repos/{repo}", headers=headers)
            from_branch = repo_details["default_branch"]
            print(f"Base branch not specified, using default branch: {from_branch}")

        branch_details = _request_json("GET", f"https://api.github.com/repos/{repo}/branches/{from_branch}", headers=headers)
        base_sha = branch_details["commit"]["sha"]
        print(f"Found SHA for base branch '{from_branch}': {base_sha}")

        # 2. Create the new branch (as a new git ref)
        ref_payload = {
            "ref": f"refs/heads/{new_branch}",
            "sha": base_sha,
        }
        created_ref = _request_json("POST", f"https://api.github.com/repos/{repo}/git/refs", headers=headers, json=ref_payload)
        
        print(f"Successfully created branch '{new_branch}' on '{repo}'.")
        print(f"URL: https://github.com/{repo}/tree/{new_branch}")

    except requests.HTTPError as e:
        if e.response is not None:
            _print_err(f"Error: {e.response.status_code} - {e.response.text}")
        else:
            _print_err(f"An HTTP error occurred: {e}")
        sys.exit(1)
    except Exception as e:
        _print_err(f"An unexpected error occurred: {e}")
        sys.exit(1)


# checkout branch
def checkout_branch(args: argparse.Namespace) -> None:
    """Checks out a branch, creating it if it doesn't exist and the user confirms."""
    branch_name = args.branch

    # Check if branch exists locally
    try:
        subprocess.run(
            ["git", "rev-parse", "--verify", f"refs/heads/{branch_name}"],
            check=True,
            capture_output=True,
            text=True,
        )
        # If it exists, check it out
        subprocess.run(["git", "checkout", branch_name], check=True)
        print(f"Switched to existing branch '{branch_name}'.")
        return
    except subprocess.CalledProcessError:
        # Branch does not exist locally, which is fine. We'll ask to create it.
        pass

    print(f"Branch '{branch_name}' does not exist.")
    try:
        answer = input("Would you like to create it? [y/n]: ").lower().strip()
        if answer not in ["y", "yes"]:
            print("Checkout aborted.")
            return
    except (KeyboardInterrupt, EOFError):
        print("\nCheckout aborted.")
        return

    # User wants to create the branch.
    print(f"Creating branch '{branch_name}'...")
    try:
        # Get repo from git remote url
        remote_url = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        
        match = re.search(r"github\.com[/:]([\w-]+/[\w-]+)(?:\.git)?$", remote_url)
        if not match:
            _print_err("Could not determine repository from remote 'origin'.")
            sys.exit(1)
        repo_slug = match.group(1)

        # Create a mock args object for create_branch
        create_args = argparse.Namespace(
            repo=repo_slug,
            branch=branch_name,
            from_branch=args.from_branch, # Pass along from_branch if provided
        )
        create_branch(create_args) # Call the existing create_branch function

        # Now that it's created on the remote, fetch and check it out
        print("Fetching from remote...")
        subprocess.run(["git", "fetch", "origin"], check=True)
        subprocess.run(["git", "checkout", branch_name], check=True)
        print(f"Successfully created and switched to branch '{branch_name}'.")

    except subprocess.CalledProcessError as e:
        _print_err(f"A git command failed: {e.stderr}")
        sys.exit(1)
    except Exception as e:
        _print_err(f"An unexpected error occurred during branch creation: {e}")
        sys.exit(1)



# list repo issues 
def list_repo_issues(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    issues = response.json()
    if not issues:
        print(f"There are no issues for this repo {repo}.")
    else:
        print(f"The number of issues are {len(issues)}. The issues for the repo {repo} are as follows:")
        for issue in issues:
            number = issue.get("number", "?")
            title = issue.get("title", "")
            print(f"- #{number}: {title}")


# create issue
def create_issue(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)


    owner = args.owner
    repo = args.repo
    title = args.title
    body = args.body

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    body = {
        "title": title,
        "body": body,
    }

    response = requests.post(url, headers=headers, json=body)
    if response.status_code == 201:
        issue = response.json()
        print(f"Issue created successfully! Issue #{issue.get('number', '?')}: {issue.get('title', '')}")
        print(f"URL: {issue.get('html_url', 'N/A')}")
        return

# get an issue
def get_issue(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    issue_number = args.issue_number

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    issue = response.json()
    
    print(f"Issue #{issue.get('number', '?')}: {issue.get('title', '')}")
    print(f"State: {issue.get('state', 'N/A')}")
    print(f"Created by: {issue.get('user', {}).get('login', 'N/A')}")
    print(f"Created at: {issue.get('created_at', 'N/A')}")
    print(f"Updated at: {issue.get('updated_at', 'N/A')}")
    print(f"URL: {issue.get('html_url', 'N/A')}")
    if issue.get('body'):
        print(f"\nDescription:\n{issue.get('body')}")


# update an issue
def update_issue(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    issue_number = args.issue_number

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    
    # Build update payload with only provided fields
    update_data = {}
    if args.title is not None:
        update_data["title"] = args.title
    if args.body is not None:
        update_data["body"] = args.body
    if args.state is not None:
        update_data["state"] = args.state
    if args.assignee is not None:
        update_data["assignee"] = args.assignee
    if args.assignees is not None:
        update_data["assignees"] = args.assignees.split(',')
    if args.milestone is not None:
        update_data["milestone"] = args.milestone
    if args.labels is not None:
        update_data["labels"] = args.labels.split(',')

    response = requests.patch(url, headers=headers, json=update_data)
    response.raise_for_status()
    issue = response.json()
    
    print(f"Issue updated successfully! Issue #{issue.get('number', '?')}: {issue.get('title', '')}")
    print(f"URL: {issue.get('html_url', 'N/A')}")


# lock an issue
def lock_issue(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    issue_number = args.issue_number

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/lock"
    
    # Build lock payload
    lock_data = {}
    if args.lock_reason:
        lock_data["lock_reason"] = args.lock_reason

    response = requests.put(url, headers=headers, json=lock_data)
    if response.status_code == 204:
        print(f"Issue #{issue_number} locked successfully!")
    else:
        response.raise_for_status()


# unlock an issue
def unlock_issue(args: argparse.Namespace) -> None:
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    owner = args.owner
    repo = args.repo
    issue_number = args.issue_number

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/lock"

    response = requests.delete(url, headers=headers)
    if response.status_code == 204:
        print(f"Issue #{issue_number} unlocked successfully!")
    else:
        response.raise_for_status()


# build parser
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GitHub OAuth Device Flow CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    # login
    p_login = sub.add_parser("login", help="Login via device authorization flow")
    p_login.add_argument("--scope", default="read:user", help="OAuth scopes to request (default: read:user)")
    p_login.add_argument("--no-open", dest="open", action="store_false", help="Do not open browser automatically")
    p_login.set_defaults(func=cmd_login)

    # whoami
    p_who = sub.add_parser("whoami", help="Show the currently authenticated user")
    p_who.set_defaults(func=cmd_whoami)

    # logout
    p_logout = sub.add_parser("logout", help="Logout and remove saved token")
    p_logout.set_defaults(func=cmd_logout)

    # list repos
    p_list_repos = sub.add_parser("list-repos", help="List all repositories for the authenticated user")
    p_list_repos.set_defaults(func=list_repos)

    # create-branch
    p_create_branch = sub.add_parser("create-branch", help="Create a new branch")
    p_create_branch.add_argument("--repo", required=True, help="The repository name in 'owner/repo' format")
    p_create_branch.add_argument("--branch", required=True, help="The name for the new branch")
    p_create_branch.add_argument("--from-branch", help="The base branch to branch from (defaults to repo's default)")
    p_create_branch.set_defaults(func=create_branch)

    # checkout-branch
    p_checkout = sub.add_parser("checkout-branch", help="Checkout a branch, creating it if needed")
    p_checkout.add_argument("branch", help="The name of the branch to checkout or create")
    p_checkout.add_argument("--from-branch", help="If creating, the base branch to branch from (defaults to repo's default)")
    p_checkout.set_defaults(func=checkout_branch)

    # merge PR
    p_merge = sub.add_parser("merge-pr", help="Merge a pull request")
    p_merge.add_argument("--owner", required=True, help="Repository owner")
    p_merge.add_argument("--repo", required=True, help="Repository name")
    p_merge.add_argument("--pull-number", type=int, required=True, help="Pull request number")
    p_merge.add_argument("--commit-title", help="Title for the merge commit")
    p_merge.add_argument("--commit-message", help="Message to append to the merge commit")
    p_merge.add_argument("--sha", help="Head SHA that must match to allow merge")
    p_merge.add_argument("--merge-method", choices=["merge", "squash", "rebase"], help="Merge method")
    p_merge.set_defaults(func=merge_pr)

    # create PR
    p_create = sub.add_parser("create-pr", help="Create a pull request")
    p_create.add_argument("--owner", required=True, help="Repository owner")
    p_create.add_argument("--repo", required=True, help="Repository name")
    p_create.add_argument("--title", required=True, help="Title for the pull request")
    p_create.add_argument(
        "--head",
        required=True,
        help="The name of the branch where your changes are implemented (e.g., 'feature-branch' or 'forkuser:feature-branch')",
    )
    p_create.add_argument("--base", required=True, help="The name of the branch you want the changes pulled into (e.g., 'main')")
    p_create.add_argument("--body", help="Body/description for the pull request")
    p_create.add_argument("--draft", action="store_true", help="Create the pull request as a draft")
    p_create.add_argument(
        "--no-maintainer-modify",
        dest="no_maintainer_modify",
        action="store_true",
        help="Disable 'Allow edits by maintainers'",
    )
    p_create.add_argument("--open", action="store_true", help="Open the created PR in your browser")
    p_create.set_defaults(func=create_pr)

    # list repo issues
    p_list_issues = sub.add_parser("list-issues", help="List all issues for a repository")
    p_list_issues.add_argument("--owner", required=True, help="Repository owner")
    p_list_issues.add_argument("--repo", required=True, help="Repository name")
    p_list_issues.set_defaults(func=list_repo_issues)

    # create issue
    p_create_issue = sub.add_parser("create-issue", help="Create an issue for a repository")
    p_create_issue.add_argument("--owner", required=True, help="Repository owner")
    p_create_issue.add_argument("--repo", required=True, help="Repository name")
    p_create_issue.add_argument("--title", required=True, help="Title for the issue")
    p_create_issue.add_argument("--body", help="Body/description for the issue")
    p_create_issue.set_defaults(func=create_issue)

    # get issue 
    p_get_issue = sub.add_parser("get-issue", help="Get a specific issue")
    p_get_issue.add_argument("--owner", required=True, help="Repository owner")
    p_get_issue.add_argument("--repo", required=True, help="Repository name")
    p_get_issue.add_argument("--issue-number", type=int, required=True, help="Issue number")
    p_get_issue.set_defaults(func=get_issue)

    # update issue
    p_update_issue = sub.add_parser("update-issue", help="Update an issue")
    p_update_issue.add_argument("--owner", required=True, help="Repository owner")
    p_update_issue.add_argument("--repo", required=True, help="Repository name")
    p_update_issue.add_argument("--issue-number", type=int, required=True, help="Issue number")
    p_update_issue.add_argument("--title", help="New title for the issue")
    p_update_issue.add_argument("--body", help="New body/description for the issue")
    p_update_issue.add_argument("--state", choices=["open", "closed"], help="State of the issue")
    p_update_issue.add_argument("--assignee", help="Username to assign the issue to")
    p_update_issue.add_argument("--assignees", help="Comma-separated list of usernames to assign")
    p_update_issue.add_argument("--milestone", type=int, help="Milestone ID to assign")
    p_update_issue.add_argument("--labels", help="Comma-separated list of label names")
    p_update_issue.set_defaults(func=update_issue)

    # lock issue 
    p_lock_issue = sub.add_parser("lock-issue", help="Lock an issue")
    p_lock_issue.add_argument("--owner", required=True, help="Repository owner")
    p_lock_issue.add_argument("--repo", required=True, help="Repository name")
    p_lock_issue.add_argument("--issue-number", type=int, required=True, help="Issue number")
    p_lock_issue.add_argument("--lock-reason", choices=["off-topic", "too heated", "resolved", "spam"], 
                             help="Reason for locking the issue")
    p_lock_issue.set_defaults(func=lock_issue)

    # unlock issue 

    p_unlock_issue = sub.add_parser("unlock-issue", help="Unlock an issue")
    p_unlock_issue.add_argument("--owner", required=True, help="Repository owner")
    p_unlock_issue.add_argument("--repo", required=True, help="Repository name")
    p_unlock_issue.add_argument("--issue-number", type=int, required=True, help="Issue number")
    p_unlock_issue.set_defaults(func=unlock_issue)

    return parser


def cli(argv: Optional[list[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    cli()


