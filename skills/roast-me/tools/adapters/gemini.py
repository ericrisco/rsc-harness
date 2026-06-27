"""Gemini CLI adapter (@google/gemini-cli).

Session files: ~/.gemini/tmp/<project_hash>/chats/*.jsonl
Format: JSON Lines. Each line is a MessageRecord.

CONFIRMED (2026-06, via official Gemini CLI docs at google-gemini.github.io
and github.com/google-gemini/gemini-cli session-management.md):
  - Base path: ~/.gemini/tmp/
  - Subdirectory: <project_hash>/chats/
  - File format: JSONL
  - MessageRecord fields include: sessionId, projectHash, model, role,
    content (array of {text: "..."}), and token usage fields.

STUBBED (exact MessageRecord schema):
  The exact JSONL schema per line has not been verified against a live Gemini
  CLI installation. The role/content structure is inferred from the official
  session-management docs. If the schema differs, parse() returns [] gracefully.

Degradation: if ~/.gemini/ does not exist, discover() returns [].
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base import BaseAdapter


class GeminiAdapter(BaseAdapter):
    RUNTIME_ID = "gemini"

    # CONFIRMED: path from official gemini-cli session-management docs.
    GEMINI_TMP_DIR = Path.home() / ".gemini" / "tmp"

    def discover(self) -> list[Path]:
        """Find all *.jsonl chat files under ~/.gemini/tmp/<hash>/chats/."""
        if not self.GEMINI_TMP_DIR.exists():
            return []
        files: list[Path] = []
        try:
            # Pattern: ~/.gemini/tmp/<project_hash>/chats/*.jsonl
            for jsonl in self.GEMINI_TMP_DIR.rglob("chats/*.jsonl"):
                try:
                    if jsonl.is_file():
                        files.append(jsonl)
                except OSError:
                    continue
        except OSError:
            return []
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)

    def parse(self, path: Path) -> list[dict[str, Any]]:
        """Parse one Gemini CLI chat JSONL file.

        STUBBED schema: expected MessageRecord with {role, content: [{text}], ...}.
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

            # STUBBED: inferred from gemini-cli session-management docs.
            role = obj.get("role", "")
            if role not in ("user", "USER"):
                continue

            content = obj.get("content", [])
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, dict):
                        text = block.get("text", "")
                        if text:
                            parts.append(text)
                text = "\n".join(parts)
            elif isinstance(content, str):
                text = content
            else:
                text = ""

            if not text.strip():
                continue

            # Gemini MessageRecord may carry token counts and model name.
            model = obj.get("model") or obj.get("modelVersion")
            ts = obj.get("timestamp") or obj.get("createTime")
            if isinstance(ts, str):
                try:
                    import datetime
                    dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    ts = dt.timestamp()
                except (ValueError, AttributeError):
                    ts = None
            elif not isinstance(ts, (int, float)):
                ts = None

            record: dict[str, Any] = {
                "runtime": self.RUNTIME_ID,
                "session_file": str(path),
                "prompt_text": text,
                "timestamp": ts,
            }
            if model:
                record["model"] = str(model)

            records.append(record)

        return records
