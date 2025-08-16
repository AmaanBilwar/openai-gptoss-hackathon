# pip install supermemory
from supermemory import Supermemory, AsyncSupermemory
import os
from dotenv import load_dotenv
from pathlib import Path
import asyncio

load_dotenv()

client = Supermemory(
    api_key=os.getenv("SUPERMEMORY_API_KEY"),
)

def add_memory():
    try: 
        response = client.memories.add(
        content="i am working on a hackahton project then hacakthon is by the company openai",
        metadata={
            "category": "project",
            "tag_1": "openai",
            "tag_2": "hackathon",
        },
        container_tags=["amaan", "project_kite", "sm_project_default"]
        )
        return response
    except Exception as e:
        return f"error: {e}"

# def upload_file():
#     try:
#         response = client.memories.upload_file(
#             file=Path("C:/Users/amaan/OneDrive/Documents/coding/openai-gptoss-hackathon/backend/merge.py"),
#             container_tags=["amaan", "project_kite", "tool_calling", "sm_project_default"],
#         )
#         return "success: uploaded to supermemory"
#     except Exception as e:
#         return f"error: {e}"
    
# def search_memory():
#     try:
#         response = client.memories.search(
#             q="hackathon project",
#         )
#         return "success: searched for memory"
#     except Exception as e:
#         return f"error: {e}"


if __name__ == "__main__":
    def main():
        print("1. Adding memory...")
        result1 = add_memory()
        print(result1)
        
        # print("\n2. Uploading file...")
        # result2 = upload_file()
        # print(result2)
        
        # print("\n3. Searching memories...")
        # result3 = search_memory()
        # print(result3)
    main()

