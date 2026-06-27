#!/usr/bin/env python3
"""Extract user prompts from AI assistant session files for prompt-quality analysis.

Scans session files for one or more runtimes (Claude, Codex, Gemini) and
extracts user prompts with contextual signals: whether an error followed,
whether the agent auto-recovered, whether the user issued a correction.

Writes a normalised JSON file to a temp path and prints:
  1. The output path
  2. A metadata summary

Usage:
    python3 extract_prompts.py [--days N] [--runtime auto|claude|codex|gemini]

    --days N        Look back N days (default 7). Accepts bare numbers too.
    --runtime ID    Which runtime to scan (default: auto = all installed runtimes).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Add the adapters package to sys.path so imports work regardless of cwd.
# ---------------------------------------------------------------------------
_TOOLS_DIR = Path(__file__).parent
sys.path.insert(0, str(_TOOLS_DIR))
from adapters.registry import get_adapters, list_runtime_ids

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_PROMPTS = 300
PROMPT_TEXT_LIMIT = 1500
CORRECTION_TEXT_LIMIT = 500
CONTEXT_BEFORE_LIMIT = 500

CORRECTION_PATTERNS = re.compile(
    r"\b(no[,.]?\s|wrong|instead|actually|don'?t|shouldn'?t|stop|not that|"
    r"I said|I meant|I asked|that'?s not|please don'?t|why did you|"
    r"you should have|that was wrong|incorrect|try again|redo|"
    r"that broke|you broke|revert|undo)\b",
    re.IGNORECASE,
)

# Model tier classification (provider-neutral labels).
# Maps substrings found in model IDs to tier names.
MODEL_TIER_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"fable|mythos", re.I), "heavy"),
    (re.compile(r"opus|gpt-4(?!.*mini)", re.I), "heavy"),
    (re.compile(r"sonnet|gpt-4.*mini|gemini-1\.5-pro|gemini-2", re.I), "balanced"),
    (re.compile(r"haiku|gpt-3\.5|gemini-1\.5-flash|gemini-flash", re.I), "light"),
]

MODEL_TIER_RANK = {"light": 0, "balanced": 1, "heavy": 2, "unknown": 1}

SIMPLE_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"^\s*(yes|ok|go ahead|looks good|lgtm|sure|do it|yep|correct|perfect)\s*[.!]?\s*$",
        r"^\s*(commit|push|merge|ship it|deploy)\s*$",
        r"^\s*(read|show|list|ls|find|check)\b.{0,80}$",
        r"^\s*(format|lint|fix.*style)\b",
        r"^\s*(what does|explain|what is|how does)\b.{0,120}$",
    ]
]

COMPLEX_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\b(design|architect|plan|strategy|migration|roadmap)\b",
        r"\b(debug|race\s*condition|memory\s*leak|performance)\b",
        r"\b(implement|build|create)\b.{30,}",
        r"\b(refactor|rewrite|overhaul)\b.*\b(entire|all|whole)\b",
    ]
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def truncate(s: str, limit: int) -> str:
    if not s or len(s) <= limit:
        return s or ""
    return s[:limit] + "..."


def classify_tier(model_id: str) -> str:
    """Map a model identifier string to a tier label."""
    if not model_id:
        return "unknown"
    for pattern, tier in MODEL_TIER_MAP:
        if pattern.search(model_id):
            return tier
    return "unknown"


def classify_complexity(text: str) -> str:
    for p in SIMPLE_PATTERNS:
        if p.match(text):
            return "simple"
    for p in COMPLEX_PATTERNS:
        if p.search(text):
            return "complex"
    return "moderate"


COMPLEXITY_TO_TIER = {"simple": "light", "moderate": "balanced", "complex": "heavy"}

# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def normalise_record(raw: dict[str, Any], position: int, total: int) -> dict[str, Any]:
    """Convert a raw adapter record into a normalised PromptRecord."""
    text = raw.get("prompt_text", "")
    length = len(text)

    has_xml_tags = bool(re.search(r"<\w[\w-]*>", text))
    has_file_paths = bool(re.search(r"(/[\w./\-]+|~\/[\w./\-]+|\.\./)", text))
    has_code_blocks = "```" in text

    model_id = raw.get("model", "") or ""
    tier = classify_tier(model_id)
    complexity = classify_complexity(text)
    recommended_tier = COMPLEXITY_TO_TIER[complexity]
    was_overkill = MODEL_TIER_RANK.get(tier, 1) > MODEL_TIER_RANK.get(recommended_tier, 1)

    return {
        "runtime": raw.get("runtime", "unknown"),
        "session_file": raw.get("session_file", ""),
        "timestamp": raw.get("timestamp"),
        "prompt_text": truncate(text, PROMPT_TEXT_LIMIT),
        "prompt_length": length,
        "prompt_position": position,
        "total_prompts_in_session": total,
        "has_xml_tags": has_xml_tags,
        "has_file_paths": has_file_paths,
        "has_code_blocks": has_code_blocks,
        # These will be populated by post-processing when session context is available.
        "followed_by_error": False,
        "error_was_recovered": False,
        "followed_by_correction": False,
        "correction_text": "",
        "error_tool": "",
        "error_text": "",
        "context_before": truncate(raw.get("context_before", ""), CONTEXT_BEFORE_LIMIT),
        # Compute fields (best-effort from adapter)
        "model": model_id,
        "model_tier": tier,
        "task_complexity": complexity,
        "recommended_tier": recommended_tier,
        "compute_was_overkill": was_overkill,
    }


# ---------------------------------------------------------------------------
# Session-aware processing (Claude-specific: reads full JSONL for context)
# ---------------------------------------------------------------------------

def process_claude_sessions(session_files: list[Path], cutoff: float) -> list[dict[str, Any]]:
    """Full session-aware extraction for Claude Code JSONL files.

    This matches the original extractor behaviour: reads each JSONL file
    sequentially to detect errors, auto-recovery, and corrections in the turns
    immediately following each user prompt.
    """
    from adapters.claude import _extract_text, _is_only_tool_results, _parse_timestamp

    prompts: list[dict[str, Any]] = []

    for sf in session_files:
        if sf.stat().st_mtime < cutoff:
            continue
        try:
            raw_lines = sf.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue

        ordered: list[tuple[int, str, dict]] = []
        for i, line in enumerate(raw_lines):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg_type = obj.get("type", "")
            if msg_type in ("user", "assistant"):
                ordered.append((i, msg_type, obj))

        session_prompts: list[int] = [
            idx for idx, (_, t, obj) in enumerate(ordered)
            if t == "user"
            and not obj.get("message", {}).get("isMeta")
            and _extract_text(obj.get("message", {}).get("content", [])).strip()
            and not _is_only_tool_results(obj.get("message", {}).get("content", []))
        ]
        total_in_session = len(session_prompts)

        for position, idx in enumerate(session_prompts, 1):
            _, _, obj = ordered[idx]
            msg = obj.get("message", {})
            content = msg.get("content", [])
            prompt_text = _extract_text(content)

            # context_before: last assistant text message before this prompt
            context_before = ""
            for k in range(idx - 1, -1, -1):
                _, kt, ko = ordered[k]
                if kt == "assistant":
                    a_content = ko.get("message", {}).get("content", [])
                    if isinstance(a_content, list):
                        for block in a_content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                context_before = block.get("text", "")
                                break
                    if context_before:
                        break

            followed_by_error = False
            error_was_recovered = False
            followed_by_correction = False
            correction_text = ""
            error_tool = ""
            error_text = ""
            error_count = 0
            success_after_error = 0

            for j in range(idx + 1, len(ordered)):
                _, j_type, j_obj = ordered[j]

                if j_type == "user":
                    u_content = j_obj.get("message", {}).get("content", [])
                    if isinstance(u_content, list):
                        for block in u_content:
                            if not isinstance(block, dict):
                                continue
                            if block.get("type") == "tool_result":
                                if block.get("is_error"):
                                    error_count += 1
                                    if not followed_by_error:
                                        followed_by_error = True
                                        tid = block.get("tool_use_id")
                                        for k in range(j - 1, idx, -1):
                                            _, kt, ko = ordered[k]
                                            if kt == "assistant":
                                                ac = ko.get("message", {}).get("content", [])
                                                if isinstance(ac, list):
                                                    for ab in ac:
                                                        if (isinstance(ab, dict)
                                                                and ab.get("type") == "tool_use"
                                                                and ab.get("id") == tid):
                                                            error_tool = ab.get("name", "")
                                                            break
                                        rc = block.get("content", [])
                                        if isinstance(rc, list):
                                            for rb in rc:
                                                if isinstance(rb, dict) and rb.get("type") == "text":
                                                    error_text = rb.get("text", "")
                                                    break
                                        elif isinstance(rc, str):
                                            error_text = rc
                                else:
                                    if error_count > 0:
                                        success_after_error += 1

                    if not j_obj.get("message", {}).get("isMeta"):
                        next_text = _extract_text(u_content)
                        if next_text.strip() and not _is_only_tool_results(u_content):
                            if CORRECTION_PATTERNS.search(next_text):
                                followed_by_correction = True
                                correction_text = next_text
                            break

            error_was_recovered = (
                followed_by_error
                and success_after_error > 0
                and not followed_by_correction
            )

            ts = _parse_timestamp(obj)
            model_id = ""
            model_tier = "unknown"

            rec = {
                "runtime": "claude",
                "session_file": str(sf),
                "timestamp": ts,
                "prompt_text": truncate(prompt_text, PROMPT_TEXT_LIMIT),
                "prompt_length": len(prompt_text),
                "prompt_position": position,
                "total_prompts_in_session": total_in_session,
                "has_xml_tags": bool(re.search(r"<\w[\w-]*>", prompt_text)),
                "has_file_paths": bool(re.search(r"(/[\w./\-]+|~\/[\w./\-]+|\.\./)", prompt_text)),
                "has_code_blocks": "```" in prompt_text,
                "followed_by_error": followed_by_error,
                "error_was_recovered": error_was_recovered,
                "followed_by_correction": followed_by_correction,
                "correction_text": truncate(correction_text, CORRECTION_TEXT_LIMIT),
                "error_tool": error_tool,
                "error_text": truncate(error_text, 500),
                "context_before": truncate(context_before, CONTEXT_BEFORE_LIMIT),
                "model": model_id,
                "model_tier": model_tier,
                "task_complexity": classify_complexity(prompt_text),
                "recommended_tier": COMPLEXITY_TO_TIER[classify_complexity(prompt_text)],
                "compute_was_overkill": False,
            }
            prompts.append(rec)

    return prompts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract user prompts from AI assistant session files."
    )
    parser.add_argument(
        "days_positional",
        nargs="?",
        type=int,
        default=None,
        metavar="DAYS",
        help="Number of days to look back (positional shorthand).",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Number of days to look back (default 7).",
    )
    parser.add_argument(
        "--runtime",
        type=str,
        default="auto",
        help=f"Runtime to scan: auto, {', '.join(list_runtime_ids())} (default: auto).",
    )
    args = parser.parse_args()

    # Resolve days: positional takes precedence over --days, both default to 7.
    days = args.days_positional or args.days or 7

    # Resolve adapters — unknown runtime exits 0 cleanly.
    try:
        adapters = get_adapters(args.runtime)
    except ValueError as exc:
        print(f"No data: {exc}", file=sys.stderr)
        _write_empty(days, args.runtime)
        return

    cutoff = time.time() - (days * 86400)

    all_prompts: list[dict[str, Any]] = []
    sessions_scanned = 0
    projects_seen: set[str] = set()

    for adapter in adapters:
        session_files = adapter.discover()

        # Filter by age
        recent_files = []
        for sf in session_files:
            try:
                if sf.stat().st_mtime >= cutoff:
                    recent_files.append(sf)
            except OSError:
                continue

        if not recent_files:
            # This adapter found no data — degrade cleanly.
            continue

        sessions_scanned += len(recent_files)

        if adapter.RUNTIME_ID == "claude":
            # Use full session-aware extraction for Claude to detect error context.
            prompts = process_claude_sessions(recent_files, cutoff)
        else:
            # For other runtimes: simple parse without cross-turn context detection.
            raw_by_session: dict[str, list[dict]] = {}
            for sf in recent_files:
                raws = adapter.parse(sf)
                raw_by_session[str(sf)] = raws

            prompts = []
            for sf_str, raws in raw_by_session.items():
                total = len(raws)
                for pos, raw in enumerate(raws, 1):
                    rec = normalise_record(raw, pos, total)
                    prompts.append(rec)

        # Collect project identifiers.
        for sf in recent_files:
            projects_seen.add(str(sf.parent))

        all_prompts.extend(prompts)

    if not all_prompts:
        runtime_label = args.runtime
        print(
            f"No transcript data found for runtime '{runtime_label}' "
            f"in the last {days} days.",
            file=sys.stderr,
        )
        print(
            "If you are using a supported runtime, check that its session "
            "directory exists and contains recent files."
        )
        _write_empty(days, args.runtime)
        return

    # Prioritise error/correction prompts, then cap.
    error_prompts = [p for p in all_prompts if p.get("followed_by_error") or p.get("followed_by_correction")]
    clean_prompts = [p for p in all_prompts if not p.get("followed_by_error") and not p.get("followed_by_correction")]
    all_prompts = (error_prompts + clean_prompts)[:MAX_PROMPTS]

    total = len(all_prompts)
    errors = sum(1 for p in all_prompts if p.get("followed_by_error"))
    recovered = sum(1 for p in all_prompts if p.get("error_was_recovered"))
    unrecovered = errors - recovered
    corrections = sum(1 for p in all_prompts if p.get("followed_by_correction"))
    avg_length = sum(p["prompt_length"] for p in all_prompts) / total if total else 0
    xml_count = sum(1 for p in all_prompts if p.get("has_xml_tags"))
    fp_count = sum(1 for p in all_prompts if p.get("has_file_paths"))
    overkill_count = sum(1 for p in all_prompts if p.get("compute_was_overkill"))

    # Model tier distribution
    tier_dist: dict[str, int] = {}
    for p in all_prompts:
        t = p.get("model_tier", "unknown")
        tier_dist[t] = tier_dist.get(t, 0) + 1

    compute_stats = {
        "tier_distribution": {t: round(c / total, 3) for t, c in tier_dist.items()},
        "heuristic_overuse_count": overkill_count,
        "heuristic_overuse_rate": round(overkill_count / total, 3) if total else 0,
    }

    result = {
        "prompts": all_prompts,
        "metadata": {
            "runtime": args.runtime,
            "days": days,
            "sessions_scanned": sessions_scanned,
            "projects_scanned": len(projects_seen),
            "total_prompts": total,
            "error_rate": round(errors / total, 3) if total else 0,
            "recovered_error_rate": round(recovered / total, 3) if total else 0,
            "effective_error_rate": round(unrecovered / total, 3) if total else 0,
            "correction_rate": round(corrections / total, 3) if total else 0,
            "avg_length": round(avg_length, 1),
            "xml_usage_rate": round(xml_count / total, 3) if total else 0,
            "file_path_rate": round(fp_count / total, 3) if total else 0,
        },
        "compute_stats": compute_stats,
    }

    # Write output to a temp file.
    fd, out_path = tempfile.mkstemp(prefix="roast-me-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2, default=str)
    except OSError as exc:
        print(f"Failed to write output: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Scanned {sessions_scanned} sessions across {len(projects_seen)} projects")
    print(
        f"Extracted {total} prompts "
        f"({errors} with errors, {recovered} auto-recovered, {unrecovered} impactful)"
    )
    print(f"Corrections: {corrections} | Avg length: {avg_length:.0f} chars | XML: {xml_count}/{total}")
    print(f"Compute: {overkill_count} overkill | tiers: {tier_dist}")
    print(f"Output: {out_path}")


def _write_empty(days: int, runtime: str) -> None:
    """Write an empty result JSON and print its path."""
    result: dict[str, Any] = {
        "prompts": [],
        "metadata": {
            "runtime": runtime,
            "days": days,
            "sessions_scanned": 0,
            "projects_scanned": 0,
            "total_prompts": 0,
            "error_rate": 0,
            "recovered_error_rate": 0,
            "effective_error_rate": 0,
            "correction_rate": 0,
            "avg_length": 0,
            "xml_usage_rate": 0,
            "file_path_rate": 0,
        },
        "compute_stats": {},
    }
    fd, out_path = tempfile.mkstemp(prefix="roast-me-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2)
    except OSError:
        pass
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
