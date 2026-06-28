"""Codex CLI adapter (@openai/codex).

Session files: ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>.jsonl
Format: JSON Lines. Each line is {"timestamp", "type", "payload"}.

CONFIRMED (2026-06, against live ~/.codex/sessions on macOS):
  - Base path / layout / naming: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
  - Line envelope: {"timestamp": ISO8601, "type": str, "payload": {...}}
  - The genuine user prompt is an `event_msg` line whose payload.type is
    "user_message", carrying the typed text in payload.message. (Injected
    AGENTS.md / developer preambles appear only as response_item/message lines,
    so keying on user_message excludes them.)
  - Assistant turns: event_msg/agent_message (payload.message) and
    response_item/message role=assistant.
  - Tool calls: response_item/function_call (payload.name).
  - Tool results: response_item/function_call_output (payload.output) — shell
    execs include a "Process exited with code N" line; N != 0 (or common error
    markers) means the command failed.
  - Model: turn_context.model / session_meta payload.

Degradation: if ~/.codex/ does not exist, discover() returns []; any unexpected
line shape is skipped, so parse() never raises.
"""

from __future__ import annotations

import datetime
import json
import re
from pathlib import Path
from typing import Any

from .base import CORRECTION_RE, BaseAdapter

# A shell tool result failed when it reports a non-zero exit code, or carries a
# common error marker with no explicit success code. Conservative on purpose —
# better to miss a soft error than to invent one.
_EXIT_CODE_RE = re.compile(r"exited with code\s+(\d+)", re.IGNORECASE)
_ERROR_MARKER_RE = re.compile(
    r"\b(command not found|no such file|permission denied|traceback \(most recent|"
    r"fatal:|panic:|segmentation fault|unhandled exception)\b",
    re.IGNORECASE,
)


def _looks_like_error(output: str) -> bool:
    if not output:
        return False
    m = _EXIT_CODE_RE.search(output)
    if m:
        return m.group(1) != "0"
    return bool(_ERROR_MARKER_RE.search(output))


def _ts(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except (ValueError, AttributeError):
            return None
    return None


class CodexAdapter(BaseAdapter):
    RUNTIME_ID = "codex"

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
        """Parse one Codex session JSONL file into user-prompt records with
        session-aware error/correction context."""
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            return []

        # 1) Flatten the file into an ordered timeline of turns.
        timeline: list[dict[str, Any]] = []
        model = ""
        pending_tool = ""
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(obj, dict):
                continue

            top_type = obj.get("type")
            payload = obj.get("payload")
            if not isinstance(payload, dict):
                payload = {}
            ts = _ts(obj.get("timestamp"))

            # Track the active model from session metadata / turn context.
            if top_type in ("session_meta", "turn_context"):
                m = payload.get("model")
                if isinstance(m, str) and m:
                    model = m
                continue

            if top_type == "event_msg":
                p_type = payload.get("type")
                if p_type == "user_message":
                    text = payload.get("message", "")
                    if isinstance(text, str) and text.strip():
                        timeline.append({"kind": "user", "text": text, "ts": ts})
                elif p_type == "agent_message":
                    text = payload.get("message", "")
                    if isinstance(text, str) and text.strip():
                        timeline.append({"kind": "assistant", "text": text, "ts": ts})
                continue

            if top_type == "response_item":
                p_type = payload.get("type")
                if p_type == "function_call":
                    name = payload.get("name", "")
                    pending_tool = name if isinstance(name, str) else ""
                elif p_type == "function_call_output":
                    output = payload.get("output", "")
                    output = output if isinstance(output, str) else json.dumps(output)
                    timeline.append({
                        "kind": "tool_output",
                        "tool": pending_tool,
                        "is_error": _looks_like_error(output),
                        "text": output,
                        "ts": ts,
                    })
                    pending_tool = ""
                # response_item/message (assistant/user/developer) is intentionally
                # ignored: genuine prompts come from event_msg/user_message, and the
                # assistant context comes from event_msg/agent_message.
                continue

        # 2) Walk the timeline; enrich each user prompt with what follows it.
        user_indices = [i for i, t in enumerate(timeline) if t["kind"] == "user"]
        records: list[dict[str, Any]] = []
        for n, idx in enumerate(user_indices):
            turn = timeline[idx]
            next_user = user_indices[n + 1] if n + 1 < len(user_indices) else len(timeline)

            followed_by_error = False
            error_tool = ""
            error_text = ""
            for j in range(idx + 1, next_user):
                t = timeline[j]
                if t["kind"] == "tool_output" and t.get("is_error"):
                    followed_by_error = True
                    error_tool = t.get("tool", "")
                    error_text = t.get("text", "")
                    break

            followed_by_correction = False
            correction_text = ""
            if next_user < len(timeline):
                nxt = timeline[next_user]["text"]
                if CORRECTION_RE.search(nxt):
                    followed_by_correction = True
                    correction_text = nxt

            # context_before: last assistant text strictly before this prompt.
            context_before = ""
            for j in range(idx - 1, -1, -1):
                if timeline[j]["kind"] == "assistant":
                    context_before = timeline[j]["text"]
                    break

            error_was_recovered = followed_by_error and not followed_by_correction

            records.append({
                "runtime": self.RUNTIME_ID,
                "session_file": str(path),
                "prompt_text": turn["text"],
                "timestamp": turn.get("ts"),
                "model": model,
                "context_before": context_before,
                "followed_by_error": followed_by_error,
                "error_was_recovered": error_was_recovered,
                "followed_by_correction": followed_by_correction,
                "correction_text": correction_text,
                "error_tool": error_tool,
                "error_text": error_text,
            })

        return records
