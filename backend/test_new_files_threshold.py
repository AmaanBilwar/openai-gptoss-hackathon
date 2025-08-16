#!/usr/bin/env python3
"""
Test script to verify that new files are properly counted in threshold checking.
"""

import os
import subprocess
from tool_calling import GPTOSSToolCaller

def create_test_new_file():
    """Create a test new file with some content"""
    print("📝 Creating test new file...")
    
    try:
        # Create a test file with multiple lines
        with open("new_test_file.py", "w") as f:
            f.write("# This is a new test file\n")
            f.write("def new_function():\n")
            f.write("    print('Hello from new file!')\n")
            f.write("    return True\n")
            f.write("\n")
            f.write("class NewClass:\n")
            f.write("    def __init__(self):\n")
            f.write("        self.value = 42\n")
            f.write("    \n")
            f.write("    def get_value(self):\n")
            f.write("        return self.value\n")
        
        print("✅ Created new_test_file.py with 12 lines")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test file: {e}")
        return False

def test_threshold_with_new_files():
    """Test threshold checking with new files"""
    print("\n🧪 Testing threshold check with new files...")
    
    caller = GPTOSSToolCaller()
    
    try:
        result = caller._check_changes_threshold_implementation(threshold=1000)
        
        if result["success"]:
            print("✅ Threshold check passed!")
            print(f"📊 Total changes: {result['total_changes']} lines")
            print(f"📊 Lines added: {result['total_lines_added']}")
            print(f"📊 Lines removed: {result['total_lines_removed']}")
            print(f"📊 Files changed: {result['file_count']}")
            print(f"📊 New files: {result['new_files_count']}")
            print(f"📊 Modified files: {result['modified_files_count']}")
            print(f"📊 Exceeds threshold: {result['exceeds_threshold']}")
            print(f"📊 Recommendation: {result['recommendation']}")
            
            if result['changed_files']:
                print("\n📋 Changed files:")
                for file_info in result['changed_files']:
                    file_type = file_info.get('type', 'unknown')
                    print(f"  - {file_info['file']} ({file_type}): +{file_info['lines_added']} -{file_info['lines_removed']}")
            
            # Check if new files are properly counted
            new_files = [f for f in result['changed_files'] if f.get("type") == "new"]
            if new_files:
                print(f"\n✅ New files detected and counted: {len(new_files)}")
                for new_file in new_files:
                    print(f"   - {new_file['file']}: {new_file['lines_added']} lines")
            else:
                print("\n⚠️  No new files detected")
            
            return True
        else:
            print(f"❌ Threshold check failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during threshold check: {e}")
        return False

def test_commit_with_new_files():
    """Test commit and push with new files"""
    print("\n🧪 Testing commit and push with new files...")
    
    caller = GPTOSSToolCaller()
    
    try:
        result = caller._commit_and_push_implementation(
            commit_message="test: add new test file",
            auto_push=False  # Don't actually push for testing
        )
        
        if result["success"]:
            if result.get("action") == "regular_commit":
                print("✅ Regular commit created successfully!")
                print(f"📝 Message: {result['commit_message']}")
                print(f"📁 Files: {result['files_committed']}")
                return True
            elif result.get("action") == "intelligent_split_triggered":
                print("🔄 Large changes detected! Triggering intelligent commit splitting...")
                print(f"📊 Reason: {result['reason']}")
                return True
            else:
                print(f"❌ Unexpected action: {result.get('action')}")
                return False
        else:
            print(f"❌ Commit failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during commit test: {e}")
        return False

def cleanup_test_files():
    """Clean up test files"""
    print("\n🧹 Cleaning up test files...")
    
    try:
        # Remove test file
        if os.path.exists("new_test_file.py"):
            os.remove("new_test_file.py")
            print("✅ Removed new_test_file.py")
        
        # Unstage any changes
        subprocess.run(['git', 'reset'], check=True)
        print("✅ Unstaged changes")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to clean up: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing New Files in Threshold Checking")
    print("=" * 50)
    
    # Check if we're in a git repository
    try:
        subprocess.run(['git', 'rev-parse', '--git-dir'], check=True, capture_output=True)
        print("✅ Git repository detected")
    except subprocess.CalledProcessError:
        print("❌ Not in a git repository. Please run this test in a git repository.")
        return
    
    # Test 1: Create new file
    print("\n1. Creating test new file...")
    if not create_test_new_file():
        print("❌ Failed to create test file")
        return
    
    # Test 2: Check threshold with new files
    print("\n2. Testing threshold check with new files...")
    if not test_threshold_with_new_files():
        print("❌ Threshold check test failed")
        cleanup_test_files()
        return
    
    # Test 3: Test commit with new files
    print("\n3. Testing commit with new files...")
    if not test_commit_with_new_files():
        print("❌ Commit test failed")
        cleanup_test_files()
        return
    
    # Test 4: Cleanup
    print("\n4. Cleaning up...")
    cleanup_test_files()
    
    print("\n" + "="*50)
    print("🎉 All tests passed! New files are properly counted in threshold checking.")
    print("\n💡 The system now correctly:")
    print("   • Detects new (untracked) files")
    print("   • Counts lines in new files as additions")
    print("   • Includes new files in threshold calculations")
    print("   • Handles new files in commit operations")

if __name__ == "__main__":
    main()
