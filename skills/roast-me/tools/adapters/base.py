"""Base adapter contract for roast-me transcript discovery.

Every runtime adapter implements two methods:
  discover() -> list[Path]  — find local session files; return [] if none found
  parse(path)  -> list[dict] — yield raw prompt-like records from one file

The adapter contract is intentionally minimal. Higher-level normalisation
(truncation, field enrichment, error/correction detection) happens in
extract_prompts.py, not here.

An adapter MUST:
  - Never raise on missing files or unexpected formats — return [] instead.
  - Tag every record with {"runtime": self.RUNTIME_ID}.
  - Return only records that look like user-initiated prompts (not tool results,
    not system messages).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class BaseAdapter(ABC):
    """Contract every runtime adapter must satisfy."""

    #: Short identifier used to tag records and in CLI --runtime flag.
    RUNTIME_ID: str = "unknown"

    @abstractmethod
    def discover(self) -> list[Path]:
        """Return a list of session file paths found for this runtime.

        Must return [] (not raise) when the runtime is not installed or no
        data directory exists.
        """

    @abstractmethod
    def parse(self, path: Path) -> list[dict[str, Any]]:
        """Parse one session file and return a list of raw prompt records.

        Each record must include at minimum:
          - "runtime": str          — the RUNTIME_ID of this adapter
          - "prompt_text": str      — the user's message text
          - "timestamp": float | None  — unix timestamp of the message (or None)
          - "session_file": str     — stringified path of the source file

        Additional fields are welcomed and used by extract_prompts.py if present
        (e.g. "model", "cost_usd").

        Must return [] (not raise) on parse failures.
        """
