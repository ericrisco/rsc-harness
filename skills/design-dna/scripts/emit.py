#!/usr/bin/env python3
"""Scaffold and validate an emitted style skill (design-dna Step 6).

    python3 emit.py <slug>              scaffold ~/.claude/skills/<slug>/ from templates
    python3 emit.py <slug> --validate   validate an existing one, exit non-zero on failure

Validation enforces the rules that are the whole point of the method, so a
half-finished capture cannot pass itself off as a skill:
  - dna.json parses and satisfies design-dna.schema.json (required keys, bounds)
  - signatures: 3 to 9        - bans: 5 or more (as absolutes)
  - tests: 8 or more          - reconstruction.attempted is true (Step 5 was run)
  - PROMPT.md is at most 2048 bytes and ends with the self-check line
  - reference/ is not empty (the image is mandatory)
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
SKILLS = os.path.dirname(PARENT)
CAP = 2048
LAST_LINE = "Before returning any output, run every test in the self-check."

REQUIRED_TOP = ["meta", "soul", "palette", "type", "space", "signatures",
                "weird_move", "bans", "tests", "reconstruction"]


def scaffold(slug):
    dest = os.path.join(SKILLS, slug)
    if os.path.exists(dest):
        sys.exit(f"refusing to overwrite {dest} - one skill per style, and this one exists")
    for sub in ("reference", "example", "scripts"):
        os.makedirs(os.path.join(dest, sub))
    for src, dst in (("templates/SKILL.md.tmpl", "SKILL.md"),
                     ("templates/PROMPT.md.tmpl", "PROMPT.md"),
                     ("templates/check.py.tmpl", "scripts/check.py")):
        shutil.copy(os.path.join(PARENT, src), os.path.join(dest, dst))
    os.chmod(os.path.join(dest, "scripts/check.py"), 0o755)
    shutil.copy(os.path.join(PARENT, "design-dna.schema.json"),
                os.path.join(dest, "design-dna.schema.json"))
    print(f"scaffolded {dest}")
    print("next: write dna.json, fill the __PLACEHOLDERS__, drop the reference image in reference/,")
    print(f"      build one worked output into example/, then: python3 {__file__} {slug} --validate")


def fail(errs, slug):
    for e in errs:
        print(f"  FAIL  {e}")
    print(f"\n{len(errs)} problem(s). {slug} is not a finished skill yet.")
    return 1


def validate(slug):
    d = os.path.join(SKILLS, slug)
    errs = []
    if not os.path.isdir(d):
        sys.exit(f"no such skill: {d}")

    dna_path = os.path.join(d, "dna.json")
    dna = None
    if not os.path.isfile(dna_path):
        errs.append("dna.json missing")
    else:
        try:
            dna = json.load(open(dna_path))
        except json.JSONDecodeError as e:
            errs.append(f"dna.json does not parse: {e}")

    if dna:
        for k in REQUIRED_TOP:
            if k not in dna:
                errs.append(f"dna.json missing required key: {k}")
        sigs = dna.get("signatures", [])
        if not 3 <= len(sigs) <= 9:
            errs.append(f"signatures must be 3-9, found {len(sigs)} (the cap forces a decision)")
        for s in sigs:
            for f in ("move", "how", "when", "never"):
                if not s.get(f):
                    errs.append(f"signature {s.get('move', '?')!r} missing {f}")
        bans = dna.get("bans", [])
        if len(bans) < 5:
            errs.append(f"bans must be 5 or more, found {len(bans)}")
        if len(bans) < len(sigs):
            errs.append("bans should outnumber positive style rules; they do the heavy lifting")
        tests = dna.get("tests", [])
        if len(tests) < 8:
            errs.append(f"tests must be 8 or more, found {len(tests)}")
        for t in tests:
            for f in ("id", "check", "fail_looks_like"):
                if not t.get(f):
                    errs.append(f"test {t.get('id', '?')!r} missing {f}")
            if "auto" not in t:
                errs.append(f"test {t.get('id', '?')!r} must declare auto: true|false")
        vague = [t["id"] for t in tests if re.search(
            r"\b(feels?|looks? (clean|premium|nice|good)|elegant|modern|polished)\b",
            t.get("check", ""), re.I)]
        if vague:
            errs.append(f"not tests, two people could disagree: {vague}")
        rec = dna.get("reconstruction", {})
        if not rec.get("attempted"):
            errs.append("reconstruction.attempted is false: Step 5 was skipped, so the spec is untested")
        elif not rec.get("gaps_found"):
            errs.append("reconstruction.gaps_found is empty: a first rebuild that found nothing means "
                        "you did not really close the reference")
        cov = dna.get("palette", {}).get("coverage") or {}
        if not cov:
            errs.append("palette.coverage missing: the most-skipped and most-decisive field")
        elif not 90 <= sum(float(v) for v in cov.values()) <= 110:
            errs.append(f"palette.coverage sums to {sum(float(v) for v in cov.values())}, expected ~100")
        for c in dna.get("palette", {}).get("colors", []):
            if re.match(r"^[a-z]+-\d{2,3}$", str(c.get("name", ""))):
                errs.append(f"colour name {c['name']!r} is systematic; image models cannot read token "
                            "names. Use a descriptive name.")
        for f in dna.get("type", {}).get("families", []):
            if not f.get("fallback"):
                errs.append(f"type family {f.get('family', '?')!r} has no fallback: silent Arial "
                            "substitution is how a reproduction dies quietly")
        sp = dna.get("space", {})
        if isinstance(sp.get("margin_pct"), str) and "px" in sp["margin_pct"]:
            errs.append("space uses pixels; percentages are what let one spec drive a carousel and a slide")

    p = os.path.join(d, "PROMPT.md")
    if not os.path.isfile(p):
        errs.append("PROMPT.md missing")
    else:
        raw = open(p, "rb").read()
        body = re.sub(rb"<!--.*?-->", b"", raw, flags=re.S).strip()
        if len(body) > CAP:
            errs.append(f"PROMPT.md is {len(body)}B of payload, cap is {CAP}B. Cut, do not negotiate.")
        txt = body.decode("utf-8", "replace")
        if LAST_LINE not in txt:
            errs.append("PROMPT.md does not end with the mandatory self-check line")
        if "__" in txt:
            errs.append("PROMPT.md still contains __PLACEHOLDERS__")
        if "dna.json" in txt:
            errs.append("PROMPT.md references dna.json; the record never enters a prompt")

    ref = os.path.join(d, "reference")
    if not os.path.isdir(ref) or not os.listdir(ref):
        errs.append("reference/ is empty. The image is mandatory and close to free.")
    ex = os.path.join(d, "example")
    if not os.path.isdir(ex) or not os.listdir(ex):
        errs.append("example/ is empty. One worked output is the canonical proof.")
    s = os.path.join(d, "SKILL.md")
    if not os.path.isfile(s):
        errs.append("SKILL.md missing")
    elif "__" in open(s).read():
        errs.append("SKILL.md still contains __PLACEHOLDERS__")

    if errs:
        return fail(errs, slug)
    print(f"  PASS  {slug} is a finished style skill.")
    print(f"        signatures {len(dna['signatures'])}, bans {len(dna['bans'])}, "
          f"tests {len(dna['tests'])}, reconstruction passes {dna['reconstruction'].get('passes', '?')}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    slug = sys.argv[1]
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        sys.exit("slug must be kebab-case")
    sys.exit(validate(slug) if "--validate" in sys.argv else (scaffold(slug) or 0))
