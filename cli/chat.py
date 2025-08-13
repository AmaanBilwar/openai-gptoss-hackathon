# git_wizard_cli.py
import click
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from openai import OpenAI
import requests
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

console = Console()

class Kite:
    def __init__(self):
        self.groq_api_key = os.getenv('GROQ_API_KEY')
        if not self.groq_api_key:
            console.print("[red]Error: GROQ_API_KEY environment variable not set[/red]")
            console.print("Please set it with: export GROQ_API_KEY=your_api_key")
        
        self.conversation_history = []
    
    def test_groq_connection(self):
        """Test if Groq API is accessible"""
        if not self.groq_api_key:
            return False, "GROQ_API_KEY not set"
        
        try:
            client = Groq(api_key=self.groq_api_key)
            # Test with a simple request
            completion = client.chat.completions.create(
                model="mixtral-8x7b-32768",
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )
            return True, "Connected successfully"
        except Exception as e:
            return False, str(e)
    
    def chat_with_ai(self, message, repo_context=None):
        """Main chat interface with GPT-OSS"""
        system_prompt = """
            You are GitWizard, an expert AI assistant specialized in Git version control and team collaboration workflows. You have deep expertise in advanced Git operations, conflict resolution, enterprise development workflows, and team productivity optimization.
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

            CURRENT CONTEXT:
            Repository: {repo_path}
            Branch: {current_branch}
            Status: {git_status}
            Conflict State: {merge_conflicts}

            CORE CAPABILITIES:
            1. Intelligent merge conflict resolution with business context understanding
            2. Proactive conflict prevention through pattern analysis
            3. Automated workflow optimization for team productivity
            4. Smart commit message generation following conventional commits
            5. Learning from team patterns to improve suggestions

            RESPONSE FORMAT:
            - Provide structured JSON for complex analysis
            - Include confidence ratings for suggestions
            - Explain reasoning behind recommendations
            - Offer multiple approaches when appropriate
            - Show exact commands with risk assessments

            Always use available tools for Git operations and maintain audit logs for continuous learning and improvement.
            """
        conversation_text = f"{system_prompt}\n\nUser: {message}\nAssistant:"
        
        client = Groq(api_key=self.groq_api_key)

        with Progress(SpinnerColumn(), TextColumn("[bold blue]GitWizard is thinking...")) as progress:
            progress.add_task("Processing", total=None)
            
            try:
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[
                    {
                        "role": "user",
                        "content": message
                    }
                    ],
                    temperature=1,
                    max_completion_tokens=8192,
                    top_p=1,
                    reasoning_effort="medium",
                    stream=True,
                    stop=None
                )
                response = ""
                for chunk in completion:
                    content = chunk.choices[0].delta.content or ""
                    response += content
                
                return response.strip()

            except Exception as e:
                return f"Error: {str(e)}"


@click.group()
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.pass_context
def cli(ctx, verbose):
    """Kite - Your AI-powered Git assistant"""
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose
    ctx.obj['wizard'] = Kite()

@cli.command()
def test():
    """Test Groq API connection"""
    wizard = Kite()
    success, message = wizard.test_groq_connection()
    
    if success:
        console.print(Panel(f"[green]✓ {message}[/green]", 
                           title="Connection Test", border_style="green"))
    else:
        console.print(Panel(f"[red]✗ {message}[/red]", 
                           title="Connection Test", border_style="red"))

@cli.command()
@click.argument('query', nargs=-1, required=True)
@click.pass_context
def ask(ctx, query):
    """Ask GitWizard anything about Git operations"""
    wizard = ctx.obj['wizard']
    question = ' '.join(query)
    
    console.print(Panel(f"[bold cyan]Question:[/bold cyan] {question}", 
                       title="🤔 Your Query", border_style="cyan"))

    try:
        response = wizard.chat_with_ai(question)
        console.print(Panel(response, 
                           title="🧙‍♂️ GitWizard's Response", border_style="green"))
    except Exception as e:
        console.print(Panel(f"[red]Error: {str(e)}[/red]", 
                           title="❌ Error", border_style="red"))

if __name__ == '__main__':
    cli()
