import json
import re
from typing import List, Dict, Any, Optional
from cerebras.cloud.sdk import Cerebras
import requests
from main import TokenStore

class GPTOSSToolCaller:
    def __init__(self, model_id: str = "gpt-oss-120b"):
        """we initialize the model and the client"""
        self.model_id = model_id
        self.client = Cerebras()
        
        # we initialize the token store
        self.token_store = TokenStore()
        
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
            
        return None

    def call_tools(self, messages: List[Dict[str, str]], reasoning_level: str = "medium", stream: bool = False) -> Dict[str, Any]:
        """Process messages and call appropriate tools using Cerebras Cloud SDK."""
        # Add reasoning level to system prompt
        system_message = f"Reasoning: {reasoning_level}\n\n"
        
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
            if stream:
                # Streaming response
                stream_response = self.client.chat.completions.create(
                    messages=api_messages,
                    model=self.model_id,
                    stream=True,
                    max_tokens=512,
                    temperature=0.7,
                    tools=self.tools
                )
                
                # Collect the full response
                full_response = ""
                for chunk in stream_response:
                    if chunk.choices[0].delta.content:
                        full_response += chunk.choices[0].delta.content
                
                # Extract tool call from the full response
                tool_call = self._extract_tool_call(full_response)
                
                if tool_call:
                    tool_name = tool_call["tool"]
                    parameters = tool_call["parameters"]
                    
                    if tool_name in self.tool_implementations:
                        # Execute the tool
                        result = self.tool_implementations[tool_name](**parameters)
                        return {
                            "tool_called": tool_name,
                            "parameters": parameters,
                            "result": result,
                            "full_response": full_response,
                            "streamed": True
                        }
                    else:
                        return {
                            "error": f"Unknown tool: {tool_name}",
                            "full_response": full_response,
                            "streamed": True
                        }
                else:
                    return {
                        "no_tool_called": True,
                        "response": full_response,
                        "streamed": True
                    }
            else:
                # Non-streaming response
                response = self.client.chat.completions.create(
                    messages=api_messages,
                    model=self.model_id,
                    max_tokens=512,
                    temperature=0.7,
                    tools=self.tools
                )
                
                # Prefer native tool calls if present
                try:
                    tool_calls = getattr(response.choices[0].message, "tool_calls", None)
                except Exception:
                    tool_calls = None
                
                if tool_calls:
                    # Execute the first function call found
                    for tc in tool_calls:
                        try:
                            if getattr(tc, "type", "") == "function":
                                func = getattr(tc, "function", None)
                                if not func:
                                    continue
                                tool_name = getattr(func, "name", None)
                                arguments_str = getattr(func, "arguments", "{}")
                                parameters = json.loads(arguments_str or "{}")
                                if tool_name in self.tool_implementations:
                                    result = self.tool_implementations[tool_name](**parameters)
                                    return {
                                        "tool_called": tool_name,
                                        "parameters": parameters,
                                        "result": result,
                                        "full_response": getattr(response.choices[0].message, "content", ""),
                                    }
                                else:
                                    return {
                                        "error": f"Unknown tool: {tool_name}",
                                        "full_response": getattr(response.choices[0].message, "content", ""),
                                    }
                        except Exception as e:
                            return {
                                "error": f"Failed executing tool: {str(e)}",
                                "raw_tool_call": str(tc),
                            }
                
                response_text = getattr(response.choices[0].message, "content", "")
                
                # Fallback: Extract tool call from text
                tool_call = self._extract_tool_call(response_text)
                
                if tool_call:
                    tool_name = tool_call["tool"]
                    parameters = tool_call["parameters"]
                    
                    if tool_name in self.tool_implementations:
                        # Execute the tool
                        result = self.tool_implementations[tool_name](**parameters)
                        return {
                            "tool_called": tool_name,
                            "parameters": parameters,
                            "result": result,
                            "full_response": response_text
                        }
                    else:
                        return {
                            "error": f"Unknown tool: {tool_name}",
                            "full_response": response_text
                        }
                else:
                    return {
                        "no_tool_called": True,
                        "response": response_text
                    }
                    
        except Exception as e:
            return {
                "error": f"API call failed: {str(e)}",
                "messages": messages
            }

    def call_tools_stream(self, messages: List[Dict[str, str]], reasoning_level: str = "medium"):
        """Stream tool calls with real-time response generation."""
        # Add reasoning level to system prompt
        system_message = f"Reasoning: {reasoning_level}\n\n"
        
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
        formatted = "You are a helpful assistant with access to the following tools:\n\n"
        
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