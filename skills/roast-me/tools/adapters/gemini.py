"""Gemini CLI adapter (@google/gemini-cli).

Session files: ~/.gemini/tmp/<project_hash>/chats/session-*.json
Format: a SINGLE JSON object per file (not JSONL).

CONFIRMED (2026-06, against live ~/.gemini/tmp on macOS):
  - Base path / layout: ~/.gemini/tmp/<project_hash>/chats/*.json
  - File shape: {"sessionId", "projectHash", "startTime", "lastUpdated",
    "messages": [ {"id", "timestamp", "type", "content", ...} ]}
  - messages[].type is "user" or "gemini"; content is a plain string.
  - gemini (assistant) messages also carry "model", "thoughts", "tokens".
  - The format does NOT persist tool calls/errors as messages, so tool-error
    detection is not possible here — followed_by_error stays False (honest);
    correction detection (next user message) still works.

Degradation: if ~/.gemini/ does not exist, discover() returns []; a file that
is not the expected object shape yields no records (parse never raises).
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path
from typing import Any

from .base import CORRECTION_RE, BaseAdapter


def _ts(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except (ValueError, AttributeError):
            return None
    return None


class GeminiAdapter(BaseAdapter):
    RUNTIME_ID = "gemini"

    GEMINI_TMP_DIR = Path.home() / ".gemini" / "tmp"

    def discover(self) -> list[Path]:
        """Find all session *.json chat files under ~/.gemini/tmp/<hash>/chats/."""
        if not self.GEMINI_TMP_DIR.exists():
            return []
        files: list[Path] = []
        try:
            for jf in self.GEMINI_TMP_DIR.rglob("chats/*.json"):
                try:
                    if jf.is_file():
                        files.append(jf)
                except OSError:
                    continue
        except OSError:
            return []
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)

    def parse(self, path: Path) -> list[dict[str, Any]]:
        """Parse one Gemini chat JSON file into user-prompt records with
        correction context. Tool errors are not represented in this format."""
        try:
            obj = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(obj, dict):
            return []

        messages = obj.get("messages")
        if not isinstance(messages, list):
            return []

        # Normalise into an ordered timeline of {kind, text, model, ts}.
        timeline: list[dict[str, Any]] = []
        for m in messages:
            if not isinstance(m, dict):
                continue
            mtype = m.get("type")
            content = m.get("content", "")
            if not isinstance(content, str) or not content.strip():
                continue
            ts = _ts(m.get("timestamp"))
            if mtype == "user":
                timeline.append({"kind": "user", "text": content, "ts": ts})
            elif mtype == "gemini":
                model = m.get("model")
                timeline.append({
                    "kind": "assistant",
                    "text": content,
                    "ts": ts,
                    "model": str(model) if model else "",
                })

        user_indices = [i for i, t in enumerate(timeline) if t["kind"] == "user"]
        records: list[dict[str, Any]] = []
        for n, idx in enumerate(user_indices):
            turn = timeline[idx]
            next_user = user_indices[n + 1] if n + 1 < len(user_indices) else len(timeline)

            # Model that answered this prompt: the first assistant reply after it.
            model = ""
            context_after_assistant = ""
            for j in range(idx + 1, next_user):
                if timeline[j]["kind"] == "assistant":
                    model = timeline[j].get("model", "") or model
                    if not context_after_assistant:
                        context_after_assistant = timeline[j]["text"]
            # context_before: last assistant text strictly before this prompt.
            context_before = ""
            for j in range(idx - 1, -1, -1):
                if timeline[j]["kind"] == "assistant":
                    context_before = timeline[j]["text"]
                    break

            followed_by_correction = False
            correction_text = ""
            if next_user < len(timeline):
                nxt = timeline[next_user]["text"]
                if CORRECTION_RE.search(nxt):
                    followed_by_correction = True
                    correction_text = nxt

            records.append({
                "runtime": self.RUNTIME_ID,
                "session_file": str(path),
                "prompt_text": turn["text"],
                "timestamp": turn.get("ts"),
                "model": model,
                "context_before": context_before,
                # This format does not record tool errors — be honest, not invent.
                "followed_by_error": False,
                "error_was_recovered": False,
                "followed_by_correction": followed_by_correction,
                "correction_text": correction_text,
                "error_tool": "",
                "error_text": "",
            })

        return records
