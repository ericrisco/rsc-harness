"""Registry mapping runtime IDs to adapter classes.

Usage:

    from adapters.registry import get_adapters

    # Get adapters to run for a given --runtime flag value.
    for adapter in get_adapters("auto"):
        files = adapter.discover()
        ...

auto mode: runs EVERY registered adapter and merges results. If an adapter
finds no files (discover() returns []), it is silently skipped. Records from
each adapter are tagged with their RUNTIME_ID.

Unknown runtime: raises ValueError with a clear message so the caller can
print it and exit 0 with an empty result (never crash).
"""

from __future__ import annotations

from .base import BaseAdapter
from .claude import ClaudeAdapter
from .codex import CodexAdapter
from .gemini import GeminiAdapter

# All registered adapters. Add new runtimes here.
_ALL_ADAPTERS: list[type[BaseAdapter]] = [
    ClaudeAdapter,
    CodexAdapter,
    GeminiAdapter,
]

# Map runtime ID -> adapter class
_REGISTRY: dict[str, type[BaseAdapter]] = {
    cls.RUNTIME_ID: cls for cls in _ALL_ADAPTERS
}


def get_adapters(runtime: str) -> list[BaseAdapter]:
    """Return instantiated adapters for the given runtime identifier.

    Args:
        runtime: One of "auto", or a specific runtime ID such as "claude",
                 "codex", "gemini".

    Returns:
        A list of adapter instances. In "auto" mode, all registered adapters
        are returned so the caller can try each one and keep those with data.

    Raises:
        ValueError: If the runtime ID is not recognised.
    """
    runtime = runtime.strip().lower()
    if runtime == "auto":
        return [cls() for cls in _ALL_ADAPTERS]
    if runtime not in _REGISTRY:
        known = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(
            f"Unknown runtime '{runtime}'. Known runtimes: {known}. "
            f"Use 'auto' to try all of them."
        )
    return [_REGISTRY[runtime]()]


def list_runtime_ids() -> list[str]:
    """Return all registered runtime IDs (excluding 'auto')."""
    return sorted(_REGISTRY.keys())
