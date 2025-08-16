## notes for amaan

### need gigachad bbrain to understand these (not really)

we can add userId and container tags to seperate user memories in supermemory ai
    > so basically reuse userId from clerk or our auth provider to uniquely identify memories of a user. 


## rough notes


- whenever theres a commit + push, first run checks 
    - these checks include a threshold counter with git diff
    - 


- [ ] get git diff first  
- [ ] use git diff to see lines changed in commit or pr (diff hunks)
- [ ] get metadata (filename, path, commit sha, author, timestamp, parent commit sha)
- [ ] every change (class, method, function) + surrounding metadata uploaded to supermemory
    - [ ] whatever uploaded to supermemory needs a defined json structure 
    eg json structure:
    ```json
    {
        "id": "Unique ID", 
        "pr_id": "The ID of the original large PR.", 
        "file_path": "Path to the changed file.",
        "function_name_or_class_name": "The specific code construct affected.",
        "change_type": "addition | modification | deletion",
        "old_code_snippet": "The code before the change.",
        "new_code_snippet": "The code after the change.",
        "diff_hunk": "The actual diff content for the unit.",
        "embedding": "The vector embedding of the change unit.",
        "commit_message_summary": "A summary of the commit message (if relevant at this granular level).",
        "potential_feature_tags": "Tags inferred by an LLM about what feature this change might belong to. (Optional, for later use)"
    }
    ``` 


### how will the intelligent pr splitter work:


1. analysis 
    - parse git diff and extract change metadata
    - calculate complexity metric
        - lines changed
        - files affected
    - trigger split suggestion if thresholds exceeded

2. feature detection
    - use llm to analyze commit messages and code changes
    - Extract semantic meaning from diffs
    - Identify feature boundaries and dependencies

3. memory integration
    - query supermemory for similar historical code changes? 
    - Retrieve context about related features and patterns
    - Use embeddings to find semantically similar code changes

4. intelligent grouping
    - Group changes by feature using semantic similarity
    - Optimize for reviewability and atomicity
    - Consider dependencies and logical flow

5. pr generation 
    - Create separate branches for each feature group
    - Generate meaningful commit messages
    - Create PRs with proper titles, descriptions, and labels


### design decision: intelligent pr splitter


1. threshold config

2. feature detection strats

3. memory integration 

4. integration with current arch

5. tech considerations 
