import pytest

from core.prompt_manager import available_modes, system_prompt


def test_each_mode_has_a_specialized_prompt():
    for mode in available_modes():
        prompt = system_prompt(mode)
        assert "Jarvis" in prompt
        assert len(prompt) > 100


def test_unknown_mode_is_rejected():
    with pytest.raises(ValueError):
        system_prompt("made_up")
