import json
import re
from typing import List, Dict, Any, Optional
from cerebras.cloud.sdk import Cerebras
import requests
from main import TokenStore
from intelligent_commit_splitter import IntelligentCommitSplitter
import os

class GPTOSSToolCaller:
    def __init__(self, model_id: str = "gpt-oss-120b"):
        """we initialize the model and the client"""
        self.model_id = model_id
        self.client = Cerebras()
        
        # we initialize the token store
        self.token_store = TokenStore()
        
        # Define the system prompt once
        self.system_prompt = """Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- Provide helpful explanations when tools are executed
    
    COMMUNICATION STYLE:
    - Be very concise
    - Always prioritize safety - confirm before doing destructive operations
    - Provide context for WHY not just HOW for recommendations
    - Acknowledge risks and provide mitigation strategies
    - Dont use emojis or repeat the question
    - DONT RESPOND WITH TABLES

    SAFETY PROTOCOLS:
    - Always validate commands before execution
    - Warn about potentially destructive operations
    - Provide rollback instructions for risky operations
    - Ask for confirmation when modifying shared branches

    CORE CAPABILITIES:
    1. Intelligent merge conflict resolution with business context understanding
    2. Proactive conflict prevention through pattern analysis
    3. Automated workflow optimization for team productivity
    4. Smart commit message generation following conventional commits
    5. Learning from team patterns to improve suggestions
    6. Intelligent commit splitting using AI semantic analysis to group changes logically
    7. Automatic threshold-based commit management (triggers intelligent splitting for changes >1000 lines)

    RESPONSE FORMAT:
    - Provide structured JSON for complex analysis
    - Include confidence ratings for suggestions
    - Explain reasoning behind recommendations
    - Offer multiple approaches when appropriate
    - Show exact commands with risk assessments

    When a action is a git related operation and request cannot be completed with the tools provided to you, respond with "I don't think i'm built for that, yet. I've taken a note of a potential feature request for this. Devs will implement this asap :) "

    If the user request is not a git related operation, respond with "Sorry, I'm just a humble Git assistant. If you need help with {user request}, you'll have to ask my cousin, ChatGPT!"

    Always use available tools for Git operations and maintain audit logs for continuous learning and improvement."""
        
        # we define the available tools
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "list_repos",
                    "description": "List all repositories for the authenticated user.",
                    "parameters": {},
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "checkout_branch",
                    "description": "Checkout a branch for a given repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "branch": {
                                "type": "string",
                                "description": "The name of the branch to checkout",
                            },
                        },
                        "required": ["repo", "branch"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_pr",
                    "description": "Create a pull request for a given repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "title": {
                                "type": "string",
                                "description": "The title of the pull request",
                            },
                            "body": {
                                "type": "string",
                                "description": "The body of the pull request",
                            },
                            "head": {
                                "type": "string",
                                "description": "The head branch (defaults to 'feature-branch')",
                            },
                            "base": {
                                "type": "string",
                                "description": "The base branch (defaults to 'main')",
                            },
                        },
                        "required": ["repo", "title", "body"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_issue",
                    "description": "Create an issue for a given repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "title": {
                                "type": "string",
                                "description": "The title of the issue",
                            },
                            "body": {
                                "type": "string",
                                "description": "The body of the issue",
                            },
                        },
                        "required": ["repo", "title", "body"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_branch",
                    "description": "Create a new branch in a GitHub repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "branch": {
                                "type": "string",
                                "description": "The name for the new branch",
                            },
                            "from_branch": {
                                "type": "string",
                                "description": "The base branch to branch from (defaults to repo's default)",
                            },
                        },
                        "required": ["repo", "branch"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_issues",
                    "description": "List all issues for a repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                        },
                        "required": ["repo"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_issue",
                    "description": "Get a specific issue by number.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "issue_number": {
                                "type": "integer",
                                "description": "The issue number to retrieve",
                            },
                        },
                        "required": ["repo", "issue_number"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "update_issue",
                    "description": "Update an existing issue.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "issue_number": {
                                "type": "integer",
                                "description": "The issue number to update",
                            },
                            "title": {
                                "type": "string",
                                "description": "New title for the issue",
                            },
                            "body": {
                                "type": "string",
                                "description": "New body/description for the issue",
                            },
                            "state": {
                                "type": "string",
                                "description": "State of the issue (open or closed)",
                                "enum": ["open", "closed"],
                            },
                        },
                        "required": ["repo", "issue_number"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "merge_pr",
                    "description": "Merge a pull request.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "repo": {
                                "type": "string",
                                "description": "The repository name in 'owner/repo' format",
                            },
                            "pull_number": {
                                "type": "integer",
                                "description": "The pull request number to merge",
                            },
                            "commit_title": {
                                "type": "string",
                                "description": "Title for the merge commit",
                            },
                            "commit_message": {
                                "type": "string",
                                "description": "Message to append to the merge commit",
                            },
                            "merge_method": {
                                "type": "string",
                                "description": "Merge method to use",
                                "enum": ["merge", "squash", "rebase"],
                            },
                        },
                        "required": ["repo", "pull_number"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "intelligent_commit_split",
                    "description": "Intelligently split uncommitted changes into logical commits using AI analysis. This tool analyzes file changes semantically and groups them into meaningful commits with proper conventional commit messages.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "auto_push": {
                                "type": "boolean",
                                "description": "Whether to automatically push the commits after splitting (default: false)",
                            },
                            "dry_run": {
                                "type": "boolean",
                                "description": "Whether to only analyze and show what would be done without actually creating commits (default: false)",
                            },
                        },
                        "required": [],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "commit_and_push",
                    "description": "Commit and push changes to GitHub with automatic threshold checking. If changes exceed 1000 lines, automatically triggers intelligent commit splitting. For smaller changes, creates a regular commit with user-provided message.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "commit_message": {
                                "type": "string",
                                "description": "The commit message to use (required for regular commits)",
                            },
                            "files": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of specific files to commit (optional, commits all changes if not specified)",
                            },
                            "auto_push": {
                                "type": "boolean",
                                "description": "Whether to automatically push to remote after commit (default: true)",
                            },
                            "force_intelligent_split": {
                                "type": "boolean",
                                "description": "Force intelligent commit splitting even for small changes (default: false)",
                            },
                        },
                        "required": ["commit_message"],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "check_changes_threshold",
                    "description": "Check if uncommitted changes exceed the threshold (1000 lines) and return analysis of changes.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "threshold": {
                                "type": "integer",
                                "description": "Line threshold to check against (default: 1000)",
                            },
                        },
                        "required": [],
                    },
                }
            }
        ]
        
        # Tool implementations
        self.tool_implementations = {
            # login logout and whoami not added
            "checkout_branch": self._checkout_branch_implementation,
            "list_repos": self._list_repos_implementation,
            "create_pr": self._create_pr_implementation,
            "create_issue": self._create_issue_implementation,
            "create_branch": self._create_branch_implementation,
            "list_issues": self._list_issues_implementation,
            "get_issue": self._get_issue_implementation,
            "update_issue": self._update_issue_implementation,
            "merge_pr": self._merge_pr_implementation,
            "intelligent_commit_split": self._intelligent_commit_split_implementation,
            "commit_and_push": self._commit_and_push_implementation,
            "check_changes_threshold": self._check_changes_threshold_implementation,
        }


    def _get_github_headers(self):
        """Get GitHub API headers with authentication token."""
        token = self.token_store.load()
        if not token:
            raise ValueError("Not logged in. Run: python backend/main.py login --scope repo")
        
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "gh-oauth-cli",
        }

    def _create_pr_implementation(self, repo: str, title: str, body: str, head: str = "feature-branch", base: str = "main") -> Dict[str, Any]:
        """Implementation of create_pr function using GitHub API."""
        try:
            headers = self._get_github_headers()
            # Normalize repo (allow just repo name by inferring authenticated owner)
            if '/' not in repo:
                me = requests.get("https://api.github.com/user", headers=headers).json()
                login = me.get("login")
                if not login:
                    raise ValueError("Could not determine authenticated user for repo inference")
                repo = f"{login}/{repo}"

            owner, repo_name = repo.split('/', 1)
            url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls"

            payload = {
                "title": title,
                "head": head,
                "base": base,
                "body": body,
            }

            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 201:
                pr = response.json()
                return {
                    "success": True,
                    "pr_number": pr.get("number"),
                    "repo": repo,
                    "title": title,
                    "body": body,
                    "head": head,
                    "base": base,
                    "url": pr.get("html_url"),
                    "result": pr
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create PR: {response.status_code} - {response.text}",
                    "repo": repo,
                    "title": title,
                    "body": body
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "title": title,
                "body": body
            }

    def _create_issue_implementation(self, repo: str, title: str, body: str) -> Dict[str, Any]:
        """Implementation of create_issue function using GitHub API."""
        try:
            headers = self._get_github_headers()
            # Normalize repo (allow just repo name by inferring authenticated owner)
            if '/' not in repo:
                me = requests.get("https://api.github.com/user", headers=headers).json()
                login = me.get("login")
                if not login:
                    raise ValueError("Could not determine authenticated user for repo inference")
                repo = f"{login}/{repo}"
            owner, repo_name = repo.split('/', 1)
            url = f"https://api.github.com/repos/{owner}/{repo_name}/issues"

            payload = {
                "title": title,
                "body": body,
            }

            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 201:
                issue = response.json()
                return {
                    "success": True,
                    "issue_number": issue.get("number"),
                    "repo": repo,
                    "title": title,
                    "body": body,
                    "url": issue.get("html_url"),
                    "result": issue
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create issue: {response.status_code} - {response.text}",
                    "repo": repo,
                    "title": title,
                    "body": body
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "title": title,
                "body": body
            }

    def _create_branch_implementation(self, repo: str, branch: str, from_branch: str = None) -> Dict[str, Any]:
        """Implementation of create_branch function using GitHub API."""
        try:
            headers = self._get_github_headers()
            
            # If no base branch is specified, find the repo's default branch
            if not from_branch:
                repo_details = requests.get(f"https://api.github.com/repos/{repo}", headers=headers).json()
                from_branch = repo_details["default_branch"]

            # Get the SHA of the base branch
            branch_details = requests.get(f"https://api.github.com/repos/{repo}/branches/{from_branch}", headers=headers).json()
            base_sha = branch_details["commit"]["sha"]

            # Create the new branch
            ref_payload = {
                "ref": f"refs/heads/{branch}",
                "sha": base_sha,
            }
            response = requests.post(f"https://api.github.com/repos/{repo}/git/refs", headers=headers, json=ref_payload)
            
            if response.status_code == 201:
                return {
                    "success": True,
                    "repo": repo,
                    "branch": branch,
                    "from_branch": from_branch,
                    "url": f"https://github.com/{repo}/tree/{branch}",
                    "result": response.json()
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create branch: {response.status_code} - {response.text}",
                    "repo": repo,
                    "branch": branch
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "branch": branch
            }

    def _checkout_branch_implementation(self, repo: str, branch: str) -> Dict[str, Any]:
        """Implementation of checkout_branch function using GitHub API."""
        try:
            headers = self._get_github_headers()
            
            # Normalize repo (allow just repo name by inferring authenticated owner)
            if '/' not in repo:
                me = requests.get("https://api.github.com/user", headers=headers).json()
                login = me.get("login")
                if not login:
                    raise ValueError("Could not determine authenticated user for repo inference")
                repo = f"{login}/{repo}"
            
            url = f"https://api.github.com/repos/{repo}/branches/{branch}"
            response = requests.get(url, headers=headers)
            response.raise_for_status()

            branch_data = response.json()
            return {
                "success": True,
                "repo": repo,
                "branch": branch,
                "branch_data": branch_data,
                "url": f"https://github.com/{repo}/tree/{branch}",
                "result": branch_data
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "branch": branch
            }

    def _list_repos_implementation(self) -> Dict[str, Any]:
        """Implementation of list_repos function using GitHub API."""
        try:
            headers = self._get_github_headers()
            url = "https://api.github.com/user/repos"
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            repos = response.json()
            return {
                "success": True,
                "count": len(repos),
                "repos": repos,
                "result": repos,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    def _list_issues_implementation(self, repo: str) -> Dict[str, Any]:
        """Implementation of list_issues function using GitHub API."""
        try:
            headers = self._get_github_headers()
            url = f"https://api.github.com/repos/{repo}/issues"
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            issues = response.json()
            return {
                "success": True,
                "repo": repo,
                "issue_count": len(issues),
                "issues": issues,
                "result": issues
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo
            }

    def _get_issue_implementation(self, repo: str, issue_number: int) -> Dict[str, Any]:
        """Implementation of get_issue function using GitHub API."""
        try:
            headers = self._get_github_headers()
            url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            issue = response.json()
            return {
                "success": True,
                "repo": repo,
                "issue_number": issue_number,
                "title": issue.get("title"),
                "state": issue.get("state"),
                "url": issue.get("html_url"),
                "result": issue
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "issue_number": issue_number
            }

    def _update_issue_implementation(self, repo: str, issue_number: int, title: str = None, body: str = None, state: str = None) -> Dict[str, Any]:
        """Implementation of update_issue function using GitHub API."""
        try:
            headers = self._get_github_headers()
            url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
            
            # Build update payload with only provided fields
            update_data = {}
            if title is not None:
                update_data["title"] = title
            if body is not None:
                update_data["body"] = body
            if state is not None:
                update_data["state"] = state

            response = requests.patch(url, headers=headers, json=update_data)
            response.raise_for_status()
            
            issue = response.json()
            return {
                "success": True,
                "repo": repo,
                "issue_number": issue_number,
                "title": title,
                "body": body,
                "state": state,
                "url": issue.get("html_url"),
                "result": issue
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "issue_number": issue_number
            }

    def _merge_pr_implementation(self, repo: str, pull_number: int, commit_title: str = None, commit_message: str = None, merge_method: str = None) -> Dict[str, Any]:
        """Implementation of merge_pr function using GitHub API."""
        try:
            headers = self._get_github_headers()
            url = f"https://api.github.com/repos/{repo}/pulls/{pull_number}/merge"
            
            # Build merge payload
            merge_data = {}
            if commit_title:
                merge_data["commit_title"] = commit_title
            if commit_message:
                merge_data["commit_message"] = commit_message
            if merge_method:
                merge_data["merge_method"] = merge_method

            response = requests.put(url, headers=headers, json=merge_data)
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "repo": repo,
                    "pull_number": pull_number,
                    "commit_title": commit_title,
                    "commit_message": commit_message,
                    "merge_method": merge_method,
                    "result": response.json()
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to merge PR: {response.status_code} - {response.text}",
                    "repo": repo,
                    "pull_number": pull_number
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "repo": repo,
                "pull_number": pull_number
            }

    def _intelligent_commit_split_implementation(self, auto_push: bool = False, dry_run: bool = False) -> Dict[str, Any]:
        """Implementation of intelligent_commit_split function using the IntelligentCommitSplitter."""
        try:
            # Get API keys from environment
            supermemory_api_key = os.getenv("SUPERMEMORY_API_KEY")
            cerebras_api_key = os.getenv("CEREBRAS_API_KEY")
            
            if not supermemory_api_key:
                return {
                    "success": False,
                    "error": "SUPERMEMORY_API_KEY environment variable not set",
                    "suggestion": "Please set the SUPERMEMORY_API_KEY environment variable to use intelligent commit splitting"
                }
            
            if not cerebras_api_key:
                return {
                    "success": False,
                    "error": "CEREBRAS_API_KEY environment variable not set",
                    "suggestion": "Please set the CEREBRAS_API_KEY environment variable to use intelligent commit splitting"
                }
            
            # Initialize the intelligent commit splitter
            splitter = IntelligentCommitSplitter(supermemory_api_key, cerebras_api_key)
            
            # Run the analysis
            if dry_run:
                # For dry run, we'll just analyze without executing
                commit_groups = splitter.run_intelligent_splitting(auto_push=False)
                return {
                    "success": True,
                    "dry_run": True,
                    "commit_groups_count": len(commit_groups),
                    "commit_groups": [
                        {
                            "feature_name": group.feature_name,
                            "commit_title": group.commit_title,
                            "commit_message": group.commit_message,
                            "files": [f.file_path for f in group.files]
                        }
                        for group in commit_groups
                    ],
                    "message": f"Analysis complete! Found {len(commit_groups)} logical commit groups. No commits were created (dry run mode)."
                }
            else:
                # Execute the actual commit splitting
                commit_groups = splitter.run_intelligent_splitting(auto_push=auto_push)
                return {
                    "success": True,
                    "dry_run": False,
                    "auto_push": auto_push,
                    "commit_groups_count": len(commit_groups),
                    "commit_groups": [
                        {
                            "feature_name": group.feature_name,
                            "commit_title": group.commit_title,
                            "commit_message": group.commit_message,
                            "files": [f.file_path for f in group.files]
                        }
                        for group in commit_groups
                    ],
                    "message": f"Successfully created {len(commit_groups)} logical commits{' and pushed to remote' if auto_push else ''}."
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check that you have uncommitted changes and that the repository is in a valid state"
            }

    def _check_changes_threshold_implementation(self, threshold: int = 1000) -> Dict[str, Any]:
        """Check if uncommitted changes exceed the threshold and return analysis."""
        try:
            import subprocess
            
            # Get git diff statistics for modified/deleted files
            result = subprocess.run(
                ['git', 'diff', '--stat'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            # Check staged changes
            staged_result = subprocess.run(
                ['git', 'diff', '--cached', '--stat'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            # Get untracked (new) files
            untracked_result = subprocess.run(
                ['git', 'ls-files', '--others', '--exclude-standard'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            # Parse the diff output to count lines
            total_lines_added = 0
            total_lines_removed = 0
            changed_files = []
            
            # Parse regular diff (modified/deleted files)
            for line in result.stdout.split('\n'):
                if '|' in line and 'changed' in line:
                    # Format: "file.py | 10 +++++-----"
                    parts = line.split('|')
                    if len(parts) >= 2:
                        file_name = parts[0].strip()
                        stats = parts[1].strip()
                        # Extract numbers from stats like "10 +++++-----"
                        numbers = re.findall(r'\d+', stats)
                        if len(numbers) >= 2:
                            lines_added = int(numbers[0])
                            lines_removed = int(numbers[1])
                            total_lines_added += lines_added
                            total_lines_removed += lines_removed
                            changed_files.append({
                                "file": file_name,
                                "lines_added": lines_added,
                                "lines_removed": lines_removed,
                                "type": "modified"
                            })
            
            # Parse staged diff
            for line in staged_result.stdout.split('\n'):
                if '|' in line and 'changed' in line:
                    parts = line.split('|')
                    if len(parts) >= 2:
                        file_name = parts[0].strip()
                        stats = parts[1].strip()
                        numbers = re.findall(r'\d+', stats)
                        if len(numbers) >= 2:
                            lines_added = int(numbers[0])
                            lines_removed = int(numbers[1])
                            total_lines_added += lines_added
                            total_lines_removed += lines_removed
                            changed_files.append({
                                "file": file_name,
                                "lines_added": lines_added,
                                "lines_removed": lines_removed,
                                "type": "staged"
                            })
            
            # Handle untracked (new) files
            untracked_files = [line.strip() for line in untracked_result.stdout.split('\n') if line.strip()]
            for file_path in untracked_files:
                try:
                    # Count lines in the new file
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                        lines_added = len(content.split('\n'))
                        total_lines_added += lines_added
                        changed_files.append({
                            "file": file_path,
                            "lines_added": lines_added,
                            "lines_removed": 0,
                            "type": "new"
                        })
                except Exception as e:
                    # If we can't read the file, count it as 1 line addition
                    total_lines_added += 1
                    changed_files.append({
                        "file": file_path,
                        "lines_added": 1,
                        "lines_removed": 0,
                        "type": "new"
                    })
            
            total_changes = total_lines_added + total_lines_removed
            exceeds_threshold = total_changes > threshold
            
            return {
                "success": True,
                "total_lines_added": total_lines_added,
                "total_lines_removed": total_lines_removed,
                "total_changes": total_changes,
                "threshold": threshold,
                "exceeds_threshold": exceeds_threshold,
                "changed_files": changed_files,
                "file_count": len(changed_files),
                "new_files_count": len([f for f in changed_files if f.get("type") == "new"]),
                "modified_files_count": len([f for f in changed_files if f.get("type") in ["modified", "staged"]]),
                "recommendation": "intelligent_commit_split" if exceeds_threshold else "regular_commit"
            }
            
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Git command failed: {e}",
                "suggestion": "Make sure you're in a git repository with changes"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check that you have uncommitted changes and that the repository is in a valid state"
            }

    def _commit_and_push_implementation(self, commit_message: str, files: List[str] = None, auto_push: bool = True, force_intelligent_split: bool = False) -> Dict[str, Any]:
        """Commit and push changes with automatic threshold checking."""
        try:
            import subprocess
            
            # First check if there are any changes
            status_result = subprocess.run(
                ['git', 'status', '--porcelain'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            if not status_result.stdout.strip():
                return {
                    "success": False,
                    "error": "No changes to commit",
                    "suggestion": "Make some changes to files before committing"
                }
            
            # Check threshold unless forced to use intelligent split
            if not force_intelligent_split:
                threshold_check = self._check_changes_threshold_implementation(threshold=1000)
                
                if not threshold_check["success"]:
                    return threshold_check
                
                # If exceeds threshold, trigger intelligent commit split
                if threshold_check["exceeds_threshold"]:
                    return {
                        "success": True,
                        "action": "intelligent_split_triggered",
                        "reason": f"Changes exceed threshold ({threshold_check['total_changes']} lines > 1000)",
                        "threshold_analysis": threshold_check,
                        "message": f"Large changes detected ({threshold_check['total_changes']} lines). Automatically triggering intelligent commit splitting for better organization.",
                        "next_step": "intelligent_commit_split"
                    }
            
            # For smaller changes or forced intelligent split, proceed with regular commit
            try:
                # Stage files if specified, otherwise stage all changes
                if files:
                    for file in files:
                        subprocess.run(['git', 'add', file], check=True)
                else:
                    # Stage all changes including new files
                    subprocess.run(['git', 'add', '.'], check=True)
                
                # Create commit
                subprocess.run(['git', 'commit', '-m', commit_message], check=True)
                
                # Push if requested
                push_result = None
                if auto_push:
                    push_result = subprocess.run(
                        ['git', 'push'],
                        capture_output=True,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        check=True
                    )
                
                return {
                    "success": True,
                    "action": "regular_commit",
                    "commit_message": commit_message,
                    "files_committed": files if files else "all changes",
                    "pushed": auto_push,
                    "push_output": push_result.stdout if push_result else None,
                    "message": f"Successfully committed changes with message: '{commit_message}'"
                }
                
            except subprocess.CalledProcessError as e:
                return {
                    "success": False,
                    "error": f"Git operation failed: {e}",
                    "suggestion": "Check your git configuration and repository state"
                }
            
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Git status check failed: {e}",
                "suggestion": "Make sure you're in a git repository"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "suggestion": "Check that you have uncommitted changes and that the repository is in a valid state"
            }

    def _extract_tool_call(self, response: str) -> Optional[Dict[str, Any]]:
        """Extract tool call from model response."""
        # Look for JSON code blocks in the response
        json_pattern = r'```json\s*(\{.*?\})\s*```'
        matches = re.findall(json_pattern, response, re.DOTALL)
        
        if not matches:
            return None
            
        try:
            tool_call = json.loads(matches[0])
            if "tool" in tool_call and "parameters" in tool_call:
                return tool_call
        except json.JSONDecodeError:
            pass
            

    def call_tools_stream(self, messages: List[Dict[str, str]], reasoning_level: str = "medium"):
        """Stream tool calls with real-time response generation."""
        # Add reasoning level to system prompt
        system_message = f"{self.system_prompt}\n\nReasoning: {reasoning_level}"
        
        # Format messages with tools
        formatted_prompt = system_message + self._format_messages_with_tools(messages)
        
        # Prepare messages for Cerebras API
        api_messages = [
            {
                "role": "system",
                "content": formatted_prompt
            }
        ]
        
        # Add user messages
        for message in messages:
            if message["role"] == "user":
                api_messages.append(message)
        
        try:
            # Streaming response
            stream_response = self.client.chat.completions.create(
                messages=api_messages,
                model=self.model_id,
                stream=True,
                max_tokens=512,
                temperature=0.7,
                tools=self.tools
            )
            
            full_response = ""
            # Accumulate native streaming tool calls (OpenAI-compatible format)
            tool_calls_buffer: Dict[int, Dict[str, Any]] = {}
            for chunk in stream_response:
                delta = chunk.choices[0].delta
                # Stream any assistant text
                if getattr(delta, "content", None):
                    content = delta.content
                    full_response += content
                    yield content
                # Capture streamed tool calls
                tool_calls = getattr(delta, "tool_calls", None)
                if tool_calls:
                    for tc in tool_calls:
                        try:
                            idx = getattr(tc, "index", 0)
                            entry = tool_calls_buffer.setdefault(idx, {"name": None, "arguments": ""})
                            func = getattr(tc, "function", None)
                            if func:
                                name = getattr(func, "name", None)
                                if name:
                                    entry["name"] = name
                                args_piece = getattr(func, "arguments", None)
                                if args_piece:
                                    entry["arguments"] += args_piece
                        except Exception:
                            # ignore malformed deltas
                            pass
            
            # After streaming is complete, check for tool calls
            # 1) Prefer native tool calls captured from the stream
            if tool_calls_buffer:
                for idx in sorted(tool_calls_buffer.keys()):
                    entry = tool_calls_buffer[idx]
                    tool_name = entry.get("name")
                    args_str = entry.get("arguments", "{}") or "{}"
                    try:
                        parameters = json.loads(args_str)
                    except Exception:
                        parameters = {}
                    if tool_name in self.tool_implementations:
                        result = self.tool_implementations[tool_name](**parameters)
                        yield f"\n\nTool executed: {tool_name}\nResult: {json.dumps(result, indent=2)}"
                    else:
                        yield f"\n\nError: Unknown tool {tool_name}"
            else:
                # 2) Fallback: parse a JSON code block from text content
                tool_call = self._extract_tool_call(full_response)
                if tool_call:
                    tool_name = tool_call["tool"]
                    parameters = tool_call["parameters"]
                    if tool_name in self.tool_implementations:
                        result = self.tool_implementations[tool_name](**parameters)
                        yield f"\n\nTool executed: {tool_name}\nResult: {json.dumps(result, indent=2)}"
                    else:
                        yield f"\n\nError: Unknown tool {tool_name}"
                    
        except Exception as e:
            yield f"Error: {str(e)}"

    def _format_messages_with_tools(self, messages: List[Dict[str, str]], tools: List[Dict] = None) -> str:
        """Format messages with tools in harmony format."""
        if tools is None:
            tools = self.tools
            
        # start with system message
        formatted = ""
        
        # add tool definitions
        for tool in tools:
            if tool["type"] == "function":
                func = tool["function"]
                formatted += f"## {func['name']}\n"
                formatted += f"{func['description']}\n\n"
                if "parameters" in func and isinstance(func["parameters"], dict):
                    props = func["parameters"].get("properties") or {}
                    if props:
                        formatted += "Parameters:\n"
                        for param_name, param_info in props.items():
                            param_type = param_info.get("type", "unknown")
                            description = param_info.get("description", "")
                            required = param_name in func["parameters"].get("required", [])
                            formatted += f"- {param_name} ({param_type}){' [required]' if required else ''}: {description}\n"
                formatted += "\n"
        
        formatted += "To use a tool, respond with:\n"
        formatted += "```json\n{\n"
        formatted += '  "tool": "tool_name",\n'
        formatted += '  "parameters": {\n'
        formatted += '    "param1": "value1",\n'
        formatted += '    "param2": "value2"\n'
        formatted += '  }\n'
        formatted += '}\n'
        formatted += "```\n\n"
        
        # add conversation history
        for message in messages:
            role = message["role"]
            content = message["content"]
            formatted += f"{role.upper()}: {content}\n\n"
        
        formatted += "ASSISTANT: "
        return formatted

# Example usage
if __name__ == "__main__":
    # Initialize the tool caller
    caller = GPTOSSToolCaller()
    
    # Conversation history
    messages = []

    while True:
        # Prompt the user for input
        user_content = input("Enter your request (or type 'exit' to quit): ").strip()
        if not user_content:
            print("No input provided. Exiting.")
            break
        if user_content.lower() in ("exit", "quit"):
            print("Goodbye!")
            break

        # Add user message to conversation
        messages.append({
            "role": "user",
            "content": user_content
        })

        # Call tools with streaming
        print("Streaming response:")
        response_chunks = []
        for chunk in caller.call_tools_stream(messages, reasoning_level="medium"):
            print(chunk, end="", flush=True)
            response_chunks.append(chunk)
        print()  # Newline after streaming

        # Add assistant response to conversation
        assistant_content = "".join(response_chunks)
        messages.append({
            "role": "assistant",
            "content": assistant_content
        })