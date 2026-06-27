"""Claude Code adapter — first-class reference implementation.

Session files: ~/.claude/projects/*/*.jsonl
Format: JSON Lines, one object per line.

Each line is a conversation event with a "type" field:
  "user"      — user message (prompt or tool result)
  "assistant" — model response

User prompt records are lines where:
  - type == "user"
  - message.isMeta is falsy
  - message.content contains at least one text block (not only tool_result blocks)

This is the canonical adapter; its parsing logic is the reference for all others.

Confirmed: path and format verified against live ~/.claude/projects structure on
macOS (2026-06). The JSONL schema is stable across Claude Code versions.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .base import BaseAdapter


class ClaudeAdapter(BaseAdapter):
    RUNTIME_ID = "claude"

    # Location of Claude Code project session files.
    PROJECTS_DIR = Path.home() / ".claude" / "projects"

    def discover(self) -> list[Path]:
        """Find all *.jsonl session files under ~/.claude/projects/."""
        if not self.PROJECTS_DIR.exists():
            return []
        files: list[Path] = []
        try:
            for jsonl in self.PROJECTS_DIR.rglob("*.jsonl"):
                try:
                    if jsonl.is_file():
                        files.append(jsonl)
                except OSError:
                    continue
        except OSError:
            return []
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)

    def parse(self, path: Path) -> list[dict[str, Any]]:
        """Parse one Claude Code .jsonl session file."""
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

            if obj.get("type") != "user":
                continue

            msg = obj.get("message", {})
            if msg.get("isMeta"):
                continue

            content = msg.get("content", [])
            text = _extract_text(content)
            if not text.strip():
                continue
            # Skip messages that are only tool_result blocks
            if _is_only_tool_results(content):
                continue

            ts = _parse_timestamp(obj)
            records.append({
                "runtime": self.RUNTIME_ID,
                "session_file": str(path),
                "prompt_text": text,
                "timestamp": ts,
                # Forward the raw object so the main extractor can inspect
                # adjacent lines for error/correction context.
                "_raw": obj,
            })

        return records


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return ""


def _is_only_tool_results(content: Any) -> bool:
    if not isinstance(content, list):
        return False
    has_text = any(
        isinstance(b, dict) and b.get("type") == "text" for b in content
    )
    has_tool_result = any(
        isinstance(b, dict) and b.get("type") == "tool_result" for b in content
    )
    return has_tool_result and not has_text


def _parse_timestamp(obj: dict) -> float | None:
    ts = obj.get("timestamp")
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        return float(ts)
    if isinstance(ts, str):
        try:
            import datetime
            dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.timestamp()
        except (ValueError, AttributeError):
            pass
    return None
