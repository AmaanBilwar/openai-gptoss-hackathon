# Tests for git_wizard_cli.py
# Testing library/framework: pytest with click.testing.CliRunner for CLI interactions.
# These tests mock external dependencies (groq client and rich Progress) and environment variables.
import importlib
from types import SimpleNamespace
from click.testing import CliRunner


def import_target_module():
    """
    Import the target module under test.

    Assumes the module file is named git_wizard_cli.py at repository root
    (as indicated by the provided source), and importable as 'git_wizard_cli'.
    """
    return importlib.import_module("git_wizard_cli")


class DummyProgress:
    """Minimal Progress replacement for use within 'with Progress(...) as progress:'."""
    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def add_task(self, *args, **kwargs):
        return 1


def make_chunk(content):
    """Create a streaming chunk object compatible with chunk.choices[0].delta.content attribute access."""
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])


def test_kite_init_without_key_prints_warning(monkeypatch):
    target = import_target_module()
    # Ensure env var is absent
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    printed = []

    class DummyConsole:
        def print(self, *args, **kwargs):
            printed.append(" ".join(str(a) for a in args))

    # Silence/record console output
    monkeypatch.setattr(target, "console", DummyConsole(), raising=True)

    kite = target.Kite()
    assert isinstance(kite, target.Kite)
    assert kite.conversation_history == []
    # Verify warning messages
    assert any("GROQ_API_KEY environment variable not set" in line for line in printed), \
        "Expected warning about missing GROQ_API_KEY"


def test_test_groq_connection_returns_false_when_key_missing(monkeypatch):
    target = import_target_module()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    kite = target.Kite()
    ok, msg = kite.test_groq_connection()
    assert ok is False
    assert msg == "GROQ_API_KEY not set"


def test_test_groq_connection_success(monkeypatch):
    target = import_target_module()
    monkeypatch.setenv("GROQ_API_KEY", "dummy-key")

    class FakeCompletions:
        def create(self, **kwargs):
            # Simulate a successful minimal call
            return {"ok": True}

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeGroq:
        def __init__(self, api_key=None):
            self.chat = FakeChat()

    # Patch Groq in the target module
    monkeypatch.setattr(target, "Groq", FakeGroq, raising=True)

    kite = target.Kite()
    ok, msg = kite.test_groq_connection()
    assert ok is True
    assert msg == "Connected successfully"


def test_test_groq_connection_exception_bubbled_as_message(monkeypatch):
    target = import_target_module()
    monkeypatch.setenv("GROQ_API_KEY", "dummy-key")

    class FakeCompletions:
        def create(self, **kwargs):
            raise RuntimeError("network down")

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeGroq:
        def __init__(self, api_key=None):
            self.chat = FakeChat()

    monkeypatch.setattr(target, "Groq", FakeGroq, raising=True)

    kite = target.Kite()
    ok, msg = kite.test_groq_connection()
    assert ok is False
    assert "network down" in msg


def test_chat_with_ai_streams_and_concatenates_content(monkeypatch):
    target = import_target_module()
    monkeypatch.setenv("GROQ_API_KEY", "dummy-key")

    # Replace spinner/progress to avoid terminal interaction
    monkeypatch.setattr(target, "Progress", DummyProgress, raising=True)

    chunks = [
        make_chunk("Hello"),
        make_chunk(None),            # Should be treated as empty string
        make_chunk(" world!  "),     # Trailing whitespace to be stripped at end
    ]

    class FakeCompletions:
        def create(self, **kwargs):
            # Should be called with stream=True; return our iterable chunks
            assert kwargs.get("stream", False) is True
            return chunks

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeGroq:
        def __init__(self, api_key=None):
            self.chat = FakeChat()

    monkeypatch.setattr(target, "Groq", FakeGroq, raising=True)

    kite = target.Kite()
    resp = kite.chat_with_ai("Say hello")
    assert resp == "Hello world!"
    # Ensure no unintended state changes to conversation history
    assert kite.conversation_history == []


def test_chat_with_ai_handles_exception_and_returns_error(monkeypatch):
    target = import_target_module()
    monkeypatch.setenv("GROQ_API_KEY", "dummy-key")
    monkeypatch.setattr(target, "Progress", DummyProgress, raising=True)

    class FakeCompletions:
        def create(self, **kwargs):
            raise ValueError("bad request")

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeGroq:
        def __init__(self, api_key=None):
            self.chat = FakeChat()

    monkeypatch.setattr(target, "Groq", FakeGroq, raising=True)

    kite = target.Kite()
    resp = kite.chat_with_ai("Cause an error")
    assert resp.startswith("Error: bad request")


def test_cli_test_command_success(monkeypatch):
    target = import_target_module()
    # Replace the Kite class so the CLI uses our fake behaviors

    class FakeKiteOK:
        def __init__(self):
            pass
        def test_groq_connection(self):
            return True, "Connected successfully"

    monkeypatch.setattr(target, "Kite", FakeKiteOK, raising=True)

    runner = CliRunner()
    result = runner.invoke(target.cli, ["test"], env={"GROQ_API_KEY": "any"})
    assert result.exit_code == 0
    # The Panel content should include the success message and title
    assert "Connection Test" in result.output
    assert "Connected successfully" in result.output
    # Check mark is included in success message
    assert "✓" in result.output


def test_cli_test_command_failure(monkeypatch):
    target = import_target_module()
    class FakeKiteFail:
        def __init__(self):
            pass
        def test_groq_connection(self):
            return False, "Invalid API key"

    monkeypatch.setattr(target, "Kite", FakeKiteFail, raising=True)

    runner = CliRunner()
    result = runner.invoke(target.cli, ["test"], env={"GROQ_API_KEY": "any"})
    assert result.exit_code == 0
    assert "Connection Test" in result.output
    assert "Invalid API key" in result.output
    # Cross mark in failure message
    assert "✗" in result.output


def test_cli_ask_command_prints_response(monkeypatch):
    target = import_target_module()
    class FakeKiteAsk:
        def __init__(self):
            pass
        def chat_with_ai(self, question):
            # Ensure the question we pass through CLI reaches here
            assert "rebase" in question.lower()
            return "Here is guidance on git rebase."

    monkeypatch.setattr(target, "Kite", FakeKiteAsk, raising=True)

    runner = CliRunner()
    result = runner.invoke(target.cli, ["ask", "How", "to", "rebase?"], env={"GROQ_API_KEY": "any"})
    assert result.exit_code == 0
    # The CLI prints the response inside a Panel with a wizard title
    assert "GitWizard's Response" in result.output
    assert "Here is guidance on git rebase." in result.output