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
    response = requests.get(f"{GITHUB_API_ME_URL}/repos", headers=headers)
    response.raise_for_status()
    print(response.json())


def merge_pr(_args: argparse.Namespace) -> None:
    """Merge a pull request using GitHub REST API.

    Expects the following attributes on _args:
      - owner (str): repository owner
      - repo (str): repository name
      - pull_number (int): pull request number
      - commit_title (str, optional)
      - commit_message (str, optional)
      - sha (str, optional): head SHA that must match
      - merge_method (str, optional): one of {merge, squash, rebase}
    """
    store = TokenStore()
    token = store.load()
    if not token:
        _print_err("Not logged in. Run: python backend/main.py login")
        sys.exit(1)

    # Validate required arguments
    owner = getattr(_args, "owner", None)
    repo = getattr(_args, "repo", None)
    pull_number = getattr(_args, "pull_number", None)
    if not owner or not repo or pull_number is None:
        _print_err("Missing required arguments: --owner, --repo, --pull-number")
        sys.exit(1)

    merge_method = getattr(_args, "merge_method", None)
    if merge_method is not None and merge_method not in {"merge", "squash", "rebase"}:
        _print_err("Invalid --merge-method. Must be one of: merge, squash, rebase")
        sys.exit(1)

    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/merge"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "gh-oauth-cli",
        # GitHub API versioning header is recommended; omitting keeps parity with existing calls
        # "X-GitHub-Api-Version": "2022-11-28",
    }

    body: dict = {}
    if getattr(_args, "commit_title", None):
        body["commit_title"] = _args.commit_title
    if getattr(_args, "commit_message", None):
        body["commit_message"] = _args.commit_message
    if getattr(_args, "sha", None):
        body["sha"] = _args.sha
    if merge_method:
        body["merge_method"] = merge_method

    try:
        response = requests.put(url, headers=headers, json=body)
    except requests.RequestException as exc:
        _print_err(f"Request failed: {exc}")
        sys.exit(1)

    if response.status_code == 200:
        print(response.json())
        return

    # Handle common error statuses with message surface
    try:
        payload = response.json()
        message = payload.get("message") or response.text
    except Exception:
        message = response.text

    _print_err(f"Failed to merge PR: {response.status_code} - {message}")
    if response.status_code in {403, 404, 405, 409, 422}:
        sys.exit(1)
    response.raise_for_status()

