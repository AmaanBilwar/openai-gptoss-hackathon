import argparse
import json
import os
import sys
import time
import webbrowser
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
        # Human-friendly confirmation
        try:
            pr_num = pr.get("number")
            pr_url = pr.get("html_url")
            if pr_num and pr_url:
                print(f"Created PR #{pr_num} - {pr_url}")
        except Exception:
            pass
        # Full response for tooling/debugging
        print(pr)
        # Optionally open in browser
        if getattr(args, "open", False):
            try:
                html_url = pr.get("html_url")
                if html_url:
                    webbrowser.open(html_url, new=2)
            except Exception:
                pass
        return

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

    return parser


def cli(argv: Optional[list[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    cli()


