import subprocess
import os
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
from supermemory import Supermemory
from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv


load_dotenv()

@dataclass
class FileChange:
    """Represents a change in a single file"""
    file_path: str
    change_type: str  # 'added', 'modified', 'deleted'
    before_content: Optional[str] = None
    after_content: Optional[str] = None
    diff_content: str = ""
    total_lines_added: int = 0
    total_lines_removed: int = 0


@dataclass
class CommitGroup:
    """Represents a logical group of changes that should be in one commit"""
    feature_name: str
    description: str
    files: List[FileChange]
    commit_title: str
    commit_message: str


class SupermemoryClient:
    """Client for interacting with Supermemory AI Memory API using the Python SDK"""
    
    def __init__(self, api_key: str):
        self.client = Supermemory(api_key=api_key)
    
    def add_memory(self, content: str, metadata: Dict[str, Any] = None, container_tags: List[str] = None) -> Dict[str, Any]:
        """Add a memory to Supermemory using the SDK"""
        try:
            response = self.client.memories.add(
                content=content,
                metadata=metadata or {},
                container_tags=container_tags or []
            )
            return response
        except Exception as e:
            print(f"Error adding memory to Supermemory: {e}")
            return {"error": str(e)}
    
    def search_memories(self, query: str, limit: int = 10, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Search memories in Supermemory using the SDK"""
        try:
            response = self.client.search.execute(
                q=query,
                limit=limit
            )
            return response
        except Exception as e:
            print(f"Error searching memories in Supermemory: {e}")
            return {"error": str(e)}


class CerebrasLLM:
    """Client for interacting with Cerebras LLM"""
    
    def __init__(self, api_key: str):
        self.client = Cerebras(api_key=api_key)
    
    def generate_commit_message(self, file_changes: List[FileChange], feature_name: str) -> Tuple[str, str]:
        """Generate commit title and message using LLM"""
        
        # Prepare context for the LLM
        context = f"""
Files changed:
"""
        
        for change in file_changes:
            context += f"- {change.file_path} ({change.change_type})\n"
            if change.diff_content:
                context += f"  Changes: {change.diff_content[:200]}...\n"
        
        context += f"""
Group: {feature_name}

Generate a commit message in this exact format:
TITLE: feat: your title here (max 50 chars)
MESSAGE: Your detailed message here explaining what was changed and why.

Use conventional commit format (feat:, fix:, docs:, style:, refactor:, test:, chore:, perf:, ci:, build:)
Focus on business value and user impact, not just technical details.
"""
        
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a git commit message generator. Always respond with exactly two lines: TITLE: followed by MESSAGE:. Never include markdown, explanations, or extra formatting."
                    },
                    {
                        "role": "user",
                        "content": context
                    }
                ],
                model="llama3.1-8b",
                max_tokens=200,
                temperature=0.7
            )
            
            # Simple parsing - just split on TITLE: and MESSAGE:
            content = response.choices[0].message.content.strip()
            
            # Extract title and message
            title = ""
            message = ""
            
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('TITLE:'):
                    title = line.replace('TITLE:', '').strip()
                elif line.startswith('MESSAGE:'):
                    message = line.replace('MESSAGE:', '').strip()
            
            # Fallback if parsing fails
            if not title:
                title = f"feat: {feature_name}"
            if not message:
                message = f"Changes related to {feature_name}"
            
            return title, message
            
        except Exception as e:
            print(f"Error generating commit message: {e}")
            # Fallback to basic format
            return f"feat: {feature_name}", f"Changes related to {feature_name}"


class IntelligentCommitSplitter:
    """Main class for intelligent commit splitting"""
    
    def __init__(self, supermemory_api_key: str, cerebras_api_key: str):
        self.supermemory = SupermemoryClient(supermemory_api_key)
        self.cerebras = CerebrasLLM(cerebras_api_key)
        self.session_id = f"commit_split_{int(os.getpid())}"
    
    def get_git_diff_files(self) -> List[str]:
        """Get list of files that have been changed in git, including new files"""
        changed_files = []
        
        try:
            # Get modified/deleted files
            result = subprocess.run(
                ['git', 'diff', '--name-only'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            if result.stdout.strip():
                changed_files.extend([line.strip() for line in result.stdout.split('\n') if line.strip()])
            
            # Get newly added files (staged but not committed)
            result = subprocess.run(
                ['git', 'diff', '--cached', '--name-only'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            if result.stdout.strip():
                changed_files.extend([line.strip() for line in result.stdout.split('\n') if line.strip()])
            
            # Get untracked files (not staged yet)
            result = subprocess.run(
                ['git', 'ls-files', '--others', '--exclude-standard'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            
            if result.stdout.strip():
                changed_files.extend([line.strip() for line in result.stdout.split('\n') if line.strip()])
            
            # Remove duplicates while preserving order
            seen = set()
            unique_files = []
            for file in changed_files:
                if file not in seen:
                    seen.add(file)
                    unique_files.append(file)
            
            return unique_files
            
        except subprocess.CalledProcessError as e:
            print(f"Error getting git diff files: {e}")
            return []
    
    def get_file_content(self, file_path: str, commit_ref: str = "HEAD") -> Optional[str]:
        """Get file content at a specific commit"""
        try:
            result = subprocess.run(
                ['git', 'show', f'{commit_ref}:{file_path}'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            return result.stdout
        except subprocess.CalledProcessError:
            # File doesn't exist at this commit (new file)
            return None
    
    def get_file_diff(self, file_path: str) -> str:
        """Get the diff content for a specific file"""
        try:
            result = subprocess.run(
                ['git', 'diff', '--unified=3', file_path],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            )
            return result.stdout or ""
        except subprocess.CalledProcessError as e:
            print(f"Error getting diff for {file_path}: {e}")
            return ""
    
    def determine_change_type(self, file_path: str) -> str:
        """Determine if file was added, modified, or deleted"""
        try:
            # Check if file exists in working directory
            if os.path.exists(file_path):
                # Check if file exists in HEAD
                head_content = self.get_file_content(file_path, "HEAD")
                if head_content is None:
                    return "added"
                else:
                    return "modified"
            else:
                return "deleted"
        except Exception:
            return "modified"
    
    def extract_changes(self) -> List[FileChange]:
        """Extract all file changes with before/after content"""
        changed_files = self.get_git_diff_files()
        changes = []
        
        for file_path in changed_files:
            change_type = self.determine_change_type(file_path)
            diff_content = self.get_file_diff(file_path)
            
            # Get before and after content
            before_content = None
            after_content = None
            
            if change_type != "added":
                before_content = self.get_file_content(file_path, "HEAD")
            
            if change_type != "deleted":
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        after_content = f.read()
                except Exception:
                    pass
            
            # Count lines added/removed from diff
            lines_added = len([line for line in (diff_content or "").split('\n') 
                             if line.startswith('+') and not line.startswith('+++')])
            lines_removed = len([line for line in (diff_content or "").split('\n') 
                               if line.startswith('-') and not line.startswith('---')])
            
            changes.append(FileChange(
                file_path=file_path,
                change_type=change_type,
                before_content=before_content,
                after_content=after_content,
                diff_content=diff_content,
                total_lines_added=lines_added,
                total_lines_removed=lines_removed
            ))
        
        return changes
    
    def upload_to_supermemory(self, changes: List[FileChange]) -> None:
        """Upload before/after file contents to Supermemory for semantic analysis"""
        print("📤 Uploading file contents to Supermemory for semantic analysis...")
        
        for change in changes:
            # Upload before content if it exists
            if change.before_content:
                self.supermemory.add_memory(
                    content=change.before_content,
                    metadata={
                        "file_path": change.file_path,
                        "type": "before",
                        "change_type": change.change_type,
                        "session_id": self.session_id
                    },
                    container_tags=[self.session_id, "before"]
                )
            
            # Upload after content if it exists
            if change.after_content:
                self.supermemory.add_memory(
                    content=change.after_content,
                    metadata={
                        "file_path": change.file_path,
                        "type": "after",
                        "change_type": change.change_type,
                        "session_id": self.session_id
                    },
                    container_tags=[self.session_id, "after"]
                )
            
            # Upload diff content
            if change.diff_content:
                self.supermemory.add_memory(
                    content=change.diff_content,
                    metadata={
                        "file_path": change.file_path,
                        "type": "diff",
                        "change_type": change.change_type,
                        "session_id": self.session_id,
                        "lines_added": change.total_lines_added,
                        "lines_removed": change.total_lines_removed
                    },
                    container_tags=[self.session_id, "diff"]
                )
    
    def analyze_semantic_relationships(self, changes: List[FileChange]) -> List[CommitGroup]:
        """Use Supermemory to analyze semantic relationships and group changes"""
        print("🔍 Analyzing semantic relationships between changes...")
        
        # Query Supermemory to understand feature relationships
        queries = [
            "What changes implement the same feature?",
            "What is the logical separation between these changes?",
            "Group these file changes by functionality and purpose",
            "Which changes are related to the same user-facing feature?"
        ]
        
        all_results = []
        for query in queries:
            try:
                results = self.supermemory.search_memories(
                    query=query,
                    limit=20,
                    filters={
                        "AND": [
                            {
                                "key": "session_id",
                                "value": self.session_id
                            }
                        ]
                    }
                )
                all_results.append(results)
            except Exception as e:
                print(f"Error querying Supermemory: {e}")
        
        # Analyze results to group files
        # For now, use a simple heuristic-based grouping
        # In a full implementation, you'd parse the semantic analysis results
        return self.group_changes_heuristic(changes)
    
    def group_changes_heuristic(self, changes: List[FileChange]) -> List[CommitGroup]:
        """Group changes using heuristic rules as fallback"""
        groups = {}
        
        for change in changes:
            # Determine group based on file path and type
            group_key = self.determine_group_key(change.file_path)
            
            if group_key not in groups:
                groups[group_key] = []
            
            groups[group_key].append(change)
        
        # Convert to CommitGroup objects
        commit_groups = []
        for group_key, file_changes in groups.items():
            # Generate commit message using LLM
            title, message = self.cerebras.generate_commit_message(file_changes, group_key)
            
            commit_groups.append(CommitGroup(
                feature_name=group_key,
                description=f"Changes related to {group_key}",
                files=file_changes,
                commit_title=title,
                commit_message=message
            ))
        
        return commit_groups
    
    def determine_group_key(self, file_path: str) -> str:
        """Determine the logical group for a file based on path"""
        path_parts = Path(file_path).parts
        
        # Group by top-level directory
        if len(path_parts) > 1:
            top_dir = path_parts[0].lower()
            if top_dir in ['frontend', 'client', 'ui', 'src', 'components']:
                return 'frontend'
            elif top_dir in ['backend', 'server', 'api', 'services']:
                return 'backend'
            elif top_dir in ['docs', 'documentation', 'readme']:
                return 'documentation'
            elif top_dir in ['tests', 'test', 'spec']:
                return 'testing'
            elif top_dir in ['config', 'conf', 'settings']:
                return 'configuration'
            elif top_dir in ['scripts', 'tools', 'utils']:
                return 'utilities'
        
        # Group by file extension
        file_ext = Path(file_path).suffix.lower()
        if file_ext in ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c']:
            return 'code'
        elif file_ext in ['.md', '.txt', '.rst']:
            return 'documentation'
        elif file_ext in ['.json', '.yaml', '.yml', '.toml', '.ini']:
            return 'configuration'
        
        return 'other'
    
    def execute_commit_splitting(self, commit_groups: List[CommitGroup], auto_push: bool = False) -> bool:
        """Execute the commit splitting process by creating separate git commits"""
        print("🎯 Executing commit splitting...")
        print(f"📊 Total commit groups to process: {len(commit_groups)}")
        
        # Store current branch name
        try:
            current_branch = subprocess.run(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=True
            ).stdout.strip()
            print(f"📍 Current branch: {current_branch}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Error getting current branch: {e}")
            return False
        
        # Create a backup branch before making changes
        backup_branch = f"backup-before-split-{int(os.getpid())}"
        try:
            subprocess.run(['git', 'checkout', '-b', backup_branch], check=True)
            subprocess.run(['git', 'checkout', current_branch], check=True)
            print(f"💾 Created backup branch: {backup_branch}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Error creating backup branch: {e}")
            return False
        
        successful_commits = 0
        
        for i, group in enumerate(commit_groups, 1):
            print(f"\n--- Processing Group {i}/{len(commit_groups)} ---")
            print(f"Feature: {group.feature_name}")
            print(f"Title: {group.commit_title}")
            print(f"Files: {[f.file_path for f in group.files]}")
            
            try:
                # Reset staging area
                subprocess.run(['git', 'reset'], check=True)
                
                # Stage only the files for this group
                for file_change in group.files:
                    file_path = file_change.file_path
                    
                    if file_change.change_type == "deleted":
                        # Remove file from git tracking
                        subprocess.run(['git', 'rm', file_path], check=True)
                        print(f"   🗑️  Staged deletion: {file_path}")
                    else:
                        # Add file to staging
                        subprocess.run(['git', 'add', file_path], check=True)
                        print(f"   ➕ Staged: {file_path}")
                
                # Check if there are any staged changes
                staged_files = subprocess.run(
                    ['git', 'diff', '--cached', '--name-only'],
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    check=True
                ).stdout.strip()
                
                if not staged_files:
                    print(f"   ⚠️  No changes to commit for group {group.feature_name}")
                    continue
                
                # Create commit with title and message
                commit_message = f"{group.commit_title}\n\n{group.commit_message}"
                
                subprocess.run(
                    ['git', 'commit', '-m', commit_message],
                    check=True
                )
                
                print(f"   ✅ Created commit: {group.commit_title}")
                successful_commits += 1
                
            except subprocess.CalledProcessError as e:
                print(f"   ❌ Error creating commit for group {group.feature_name}: {e}")
                continue
        
        print(f"\n📊 Commit splitting completed!")
        print(f"✅ Successfully created {successful_commits} commits out of {len(commit_groups)} groups")
        
        # Push commits if requested
        if auto_push and successful_commits > 0:
            print(f"\n🚀 Pushing commits to remote...")
            try:
                subprocess.run(['git', 'push', 'origin', current_branch], check=True)
                print(f"✅ Successfully pushed {successful_commits} commits to {current_branch}")
            except subprocess.CalledProcessError as e:
                print(f"❌ Error pushing commits: {e}")
                print(f"💡 You can manually push using: git push origin {current_branch}")
                return False
        
        print(f"\n💾 Backup branch created: {backup_branch}")
        print(f"💡 To revert all changes: git reset --hard {backup_branch}")
        
        return successful_commits > 0
    
    def run_intelligent_splitting(self, auto_push: bool = False) -> List[CommitGroup]:
        """Main method to run the intelligent commit splitting process"""
        print("🚀 Starting Intelligent Commit Splitting Analysis...")
        
        # Step 1: Extract all file changes
        print("📊 Step 1: Extracting file changes...")
        changes = self.extract_changes()
        print(f"Found {len(changes)} files with changes")
        
        if not changes:
            print("No changes detected in git diff")
            return []
        
        # Step 2: Upload to Supermemory for semantic analysis
        print("📤 Step 2: Uploading to Supermemory for semantic analysis...")
        self.upload_to_supermemory(changes)
        
        # Step 3: Analyze semantic relationships
        print("🔍 Step 3: Analyzing semantic relationships...")
        commit_groups = self.analyze_semantic_relationships(changes)
        print(f"Identified {len(commit_groups)} logical commit groups")
        
        # Step 4: Display results
        print("\n📋 Commit Groups Identified:")
        for i, group in enumerate(commit_groups, 1):
            print(f"\n{i}. {group.feature_name}")
            print(f"   Title: {group.commit_title}")
            print(f"   Description: {group.commit_message}")
            print(f"   Files: {[f.file_path for f in group.files]}")
        
        # Step 5: Execute if requested
        if auto_push:
            self.execute_commit_splitting(commit_groups, auto_push=auto_push)
        
        return commit_groups


def main():
    """Main function for testing"""
    # Get API keys from environment
    supermemory_api_key = os.getenv("SUPERMEMORY_API_KEY")
    cerebras_api_key = os.getenv("CEREBRAS_API_KEY")
    
    if not supermemory_api_key:
        print("❌ SUPERMEMORY_API_KEY environment variable not set")
        return
    
    if not cerebras_api_key:
        print("❌ CEREBRAS_API_KEY environment variable not set")
        return
    
    # Initialize the intelligent commit splitter
    splitter = IntelligentCommitSplitter(supermemory_api_key, cerebras_api_key)
    
    # Run the analysis
    commit_groups = splitter.run_intelligent_splitting(auto_push=True)
    
    if commit_groups:
        print(f"\n✅ Analysis completed! Found {len(commit_groups)} commit groups.")
        print("This was a dry run - no actual commits were created.")
    else:
        print("\n❌ No changes detected or analysis failed.")


if __name__ == "__main__":
    main()
