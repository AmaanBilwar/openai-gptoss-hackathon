# git_wizard_cli.py
import click
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.markdown import Markdown
import asyncio
from openai import OpenAI

console = Console()

class GitWizardCLI:
    def __init__(self):
        self.client = OpenAI(
            base_url="http://localhost:11434/v1",  # GPT-OSS endpoint
            api_key="local"
        )
        self.conversation_history = []
    
    async def chat_with_ai(self, message, repo_context=None):
        """Main chat interface with GPT-OSS"""
        system_prompt = self.build_system_prompt(repo_context)
        
        with Progress(SpinnerColumn(), TextColumn("[bold blue]GitWizard is analyzing...")) as progress:
            progress.add_task("Processing", total=None)
            
            response = self.client.chat.completions.create(
                model="gpt-oss",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                tools=self.get_git_tools(),
                tool_choice="auto"
            )
        
        return self.handle_response(response)

@click.group()
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.pass_context
def cli(ctx, verbose):
    """🧙‍♂️ GitWizard - Your AI-powered Git assistant"""
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose
    ctx.obj['wizard'] = GitWizardCLI()

@cli.command()
@click.argument('query', nargs=-1, required=True)
@click.option('--repo-path', '-r', default='.', help='Repository path')
@click.pass_context
def ask(ctx, query, repo_path):
    """Ask GitWizard anything about Git operations"""
    wizard = ctx.obj['wizard']
    question = ' '.join(query)
    
    console.print(Panel(f"[bold cyan]Question:[/bold cyan] {question}", 
                       title="🤔 Your Query", border_style="cyan"))

    
    # Chat with AI
    

    console.print(Panel('Hello World', 
                       title="🧙‍♂️ GitWizard's Response", border_style="green"))

if __name__ == '__main__':
    cli()
