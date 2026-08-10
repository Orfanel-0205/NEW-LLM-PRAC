from core.orchestrator import build_messages


def test_build_messages_contains_system_prompt_and_user_input():
    messages = build_messages("hello there", system_prompt="You are Jarvis")

    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "You are Jarvis"
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == "hello there"
