"""Reserved tool registry.

Tool execution is intentionally not exposed in the first mobile release. Giving a model shell
access requires explicit allowlists, per-action confirmation, timeouts, and an audit log.
"""

SAFE_TOOL_POLICY = {
    "requires_confirmation": True,
    "shell_enabled": False,
    "workspace_only": True,
}
