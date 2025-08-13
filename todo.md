## components: 
- CLI design and human interaction engineering
    inpiration: 
    1. mail0
    2. claudecode?
    3. codex - OpenAI
- core logic

    - convert github api into functions 
        - get: 
            1. get commit
            2. get file contents 
            3. get tag
            4. list branches
            5. list commits
            6. list tags 
            7. search code
            8. search repositories
            9. search users
            10. context : get my user profile.?

    - develop compositional / sequential tool calling logic 
        

    - basic LLM calling functions according based on prompts


- web dashboard
    - allowed / blocked commands
    - history of commands ran
    - what is the agent doing right now
    - pretty graphs, maps perhaps?


## priority:
- push
- new branch 
- merge
- make pr
- rebase?


## task distribution 

- CLI design: [add your name here]

- main logic
    - convert github api into tools : Vishesh + Amaan
        - [x] merge pr (amaan)
        - [x] new branch (vishesh)  
        - [x] create pr (amaan)
        - [ ] rebase (amaan)
        - [x] make branch (vishesh)
        - [ ] switch branches (vishesh)
        - [ ] push (amaan + vishesh)
    - tool calling logic : Amaan

    
    - LLM chat + system prompt : Ani

- web dashboard : [add your name here]
    - auth + db connection (for web dashboard settings) - Ani
    - llm history tracking + thinking / reasoning - Amaan
    - what is the agent doing right now 