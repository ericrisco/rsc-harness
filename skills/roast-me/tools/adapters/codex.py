"""Codex CLI adapter (@openai/codex).

Session files: ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>.jsonl
Format: JSON Lines. Each line is an event object.

CONFIRMED (2026-06, via official CLI reference and community tooling):
  - Base path: ~/.codex/sessions/
  - Subdirectory layout: year/month/day
  - File naming: rollout-<ISO-timestamp>.jsonl
  - Format: JSONL, one event per line

STUBBED (format details):
  The internal schema of each JSONL line has not been verified against a live
  Codex installation. Based on community-authored session viewers, events appear
  to carry {"role": "user"|"assistant", "content": "...", ...}. If the role
  field is absent or the schema differs, parse() returns [] gracefully.

Degradation: if ~/.codex/ does not exist, discover() returns [].
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base import BaseAdapter


class CodexAdapter(BaseAdapter):
    RUNTIME_ID = "codex"

    # CONFIRMED: path layout from official CLI docs and community tools.
    SESSIONS_DIR = Path.home() / ".codex" / "sessions"

    def discover(self) -> list[Path]:
        """Find all rollout-*.jsonl files under ~/.codex/sessions/."""
        if not self.SESSIONS_DIR.exists():
            return []
        files: list[Path] = []
        try:
            for jsonl in self.SESSIONS_DIR.rglob("rollout-*.jsonl"):
                try:
                    if jsonl.is_file():
                        files.append(jsonl)
                except OSError:
                    continue
        except OSError:
            return []
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)

    def parse(self, path: Path) -> list[dict[str, Any]]:
        """Parse one Codex session JSONL file.

        STUBBED schema: assumes {"role": "user", "content": "..."} event lines.
        Falls back silently if the schema differs.
        """
        records: list[dict[str, Any]] = []
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            return []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            # STUBBED: expected schema based on community session viewers.
            role = obj.get("role") or obj.get("type", "")
            if role != "user":
                continue

            content = obj.get("content", "")
            if isinstance(content, list):
                # Some formats use a content array like OpenAI chat API.
                parts = [
                    c.get("text", "") if isinstance(c, dict) else str(c)
                    for c in content
                    if isinstance(c, dict) and c.get("type") == "text"
                ]
                text = "\n".join(parts)
            elif isinstance(content, str):
                text = content
            else:
                text = ""

            if not text.strip():
                continue

            ts = obj.get("timestamp") or obj.get("created_at")
            if isinstance(ts, str):
                try:
                    import datetime
                    dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    ts = dt.timestamp()
                except (ValueError, AttributeError):
                    ts = None
            elif not isinstance(ts, (int, float)):
                ts = None

            records.append({
                "runtime": self.RUNTIME_ID,
                "session_file": str(path),
                "prompt_text": text,
                "timestamp": ts,
            })

        return records
