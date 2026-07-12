#!/usr/bin/env python3
"""Generate deterministic highlight snapshots for STELF source files.

For each input file, runs ``tree-sitter query queries/highlights.scm`` and
writes a ``.hl`` fixture with lines of the form::

    <start_row>:<start_col>-<end_row>:<end_col>\\t<capture>\\t<text>

sorted by (start_row, start_col, end_row, end_col, capture). Text is
enclosed in surrounding backticks (matching ``tree-sitter query`` output);
newlines/tabs inside are left escaped by the CLI, so entries stay on one
line each.

Two sources of inputs:

1. The 15 curated snippet files under ``test/highlight/`` — snapshots go
   alongside as ``.hl`` files with matching stems.
2. The full manifest at ``test/corpus/lf_manifest.txt`` — snapshots go
   under ``test/highlight-snapshots/`` with hyphen-joined names derived
   from the source path.

Usage::

    python scripts/gen_highlight_snapshots.py            # regenerate all
    python scripts/gen_highlight_snapshots.py --curated  # snippets only
    python scripts/gen_highlight_snapshots.py --manifest # bulk only
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
QUERY = REPO / "queries" / "highlights.scm"
HIGHLIGHT_DIR = REPO / "test" / "highlight"
SNAPSHOT_DIR = REPO / "test" / "highlight-snapshots"
MANIFEST = REPO / "test" / "corpus" / "lf_manifest.txt"

# Sample line from `tree-sitter query`:
#   "    capture: 12 - keyword.type, start: (0, 0), end: (0, 5), text: `%sort`"
CAP_RE = re.compile(
    r"capture:\s+(?:\d+\s*-\s*)?(?P<name>[A-Za-z0-9_.]+),\s+"
    r"start:\s*\((?P<sr>\d+),\s*(?P<sc>\d+)\),\s+"
    r"end:\s*\((?P<er>\d+),\s*(?P<ec>\d+)\)"
    r"(?:,\s+text:\s+`(?P<text>.*)`)?"
)


def run_query(path: Path) -> list[tuple[int, int, int, int, str, str]]:
    """Return sorted, deduped capture list for one source file."""
    res = subprocess.run(
        ["tree-sitter", "query", str(QUERY), str(path)],
        capture_output=True,
        text=True,
        cwd=REPO,
    )
    caps: set[tuple[int, int, int, int, str, str]] = set()
    for m in CAP_RE.finditer(res.stdout):
        text = m.group("text") or ""
        # Drop anonymous keyword captures on runs of whitespace (they come
        # from `_ @keyword` fields matching whole node runs; not useful in
        # snapshots and they inflate diffs).
        if not text.strip() and m.group("name") == "keyword":
            continue
        caps.add(
            (
                int(m.group("sr")),
                int(m.group("sc")),
                int(m.group("er")),
                int(m.group("ec")),
                m.group("name"),
                text,
            )
        )
    return sorted(caps)


def write_snapshot(caps: list[tuple[int, int, int, int, str, str]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"{sr}:{sc}-{er}:{ec}\t{name}\t`{text}`\n"
        for sr, sc, er, ec, name, text in caps
    ]
    out.write_text("".join(lines))


def snapshot_curated() -> int:
    n = 0
    for src in sorted(HIGHLIGHT_DIR.glob("*.stelf")):
        caps = run_query(src)
        write_snapshot(caps, src.with_suffix(".hl"))
        n += 1
    print(f"curated: wrote {n} .hl files under {HIGHLIGHT_DIR.relative_to(REPO)}")
    return n


def snapshot_manifest() -> int:
    if not MANIFEST.exists():
        print(f"skip manifest (missing {MANIFEST})", file=sys.stderr)
        return 0
    entries = [ln.strip() for ln in MANIFEST.read_text().splitlines() if ln.strip()]
    n = 0
    for rel in entries:
        src = REPO / rel
        if not src.exists():
            continue
        # e.g. new-tests2/examples/fol/fol.lf -> examples__fol__fol.hl
        stem = re.sub(r"^new-tests2/", "", rel)
        stem = re.sub(r"\.lf$", "", stem)
        stem = re.sub(r"[/\-]", "_", stem)
        stem = re.sub(r"[^A-Za-z0-9_]", "_", stem)
        out = SNAPSHOT_DIR / f"{stem}.hl"
        caps = run_query(src)
        write_snapshot(caps, out)
        n += 1
    print(f"manifest: wrote {n} .hl files under {SNAPSHOT_DIR.relative_to(REPO)}")
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--curated", action="store_true", help="only curated snippets")
    ap.add_argument("--manifest", action="store_true", help="only manifest files")
    args = ap.parse_args()

    do_all = not args.curated and not args.manifest
    if do_all or args.curated:
        snapshot_curated()
    if do_all or args.manifest:
        snapshot_manifest()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
