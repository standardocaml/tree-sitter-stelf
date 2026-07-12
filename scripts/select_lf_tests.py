#!/usr/bin/env python3
"""Select a curated subset of `.lf` files from ``new-tests2/`` for the
tree-sitter corpus.

Selection criteria (single source of truth; keep in sync with
``plans/create-a-plan-for-async-hamming.md``):

* ``examples/`` — 5 files per subdir: 4 smallest by byte size + 1 median.
  The 24 subdirs span the STELF surface (fol, arith, mini-ml, prop-calc, …),
  so this yields ~120 files with size diversity while staying cheap to parse.
* ``pages/`` — 20 prose-heavy files (contain ``%[[`` or ``%prose``) filtered
  to at most 300 lines, to exercise the outer_text / prose injection path.
* ``tslf/`` — skipped (a distinct dialect, out of scope).

Files are also filtered out if any of these conditions holds:

* File contains a legacy Twelf command the grammar does not model:
  ``%theorem``, ``%prove``, ``%clause``, ``%abbrev``, ``%trustme``.
* File is longer than 1500 lines (avoid outliers up to ~9.5k lines).

The output is a sorted list of paths (one per line, relative to
``tree-sitter-stelf/``) written to ``test/corpus/lf_manifest.txt``.
"""

from __future__ import annotations

import os
import re
import statistics
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parent.parent
TESTS_ROOT = REPO / "new-tests2"
MANIFEST = REPO / "test" / "corpus" / "lf_manifest.txt"

EXAMPLES_PER_SUBDIR = 30
PAGES_TARGET = 150
MAX_LINES = 1500
MAX_PROSE_LINES = 300

LEGACY_KW_RE = re.compile(
    r"%(theorem|prove|clause|abbrev|trustme|require|solve|subord|module|struct|signature|syntax)\b"
)
PROSE_RE = re.compile(r"%\[\[|%prose")


def line_count(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for _ in f)


def has_legacy(path: Path) -> bool:
    try:
        text = path.read_text(errors="replace")
    except OSError:
        return True  # if we can't read it, skip it
    return bool(LEGACY_KW_RE.search(text))


def contains_prose(path: Path) -> bool:
    try:
        text = path.read_text(errors="replace")
    except OSError:
        return False
    return bool(PROSE_RE.search(text))


def eligible(path: Path) -> bool:
    if line_count(path) > MAX_LINES:
        return False
    if has_legacy(path):
        return False
    return True


def pick_from_examples() -> list[Path]:
    picked: list[Path] = []
    examples = TESTS_ROOT / "examples"
    for subdir in sorted(p for p in examples.iterdir() if p.is_dir()):
        candidates = [
            p for p in subdir.rglob("*.lf") if p.is_file() and eligible(p)
        ]
        if not candidates:
            continue
        candidates.sort(key=lambda p: (p.stat().st_size, str(p)))
        # Take up to EXAMPLES_PER_SUBDIR: the ~half smallest plus evenly-spaced
        # samples from the rest, so we cover size diversity.
        keep = min(EXAMPLES_PER_SUBDIR, len(candidates))
        half = max(1, keep // 2)
        smallest = candidates[:half]
        rest_needed = keep - half
        pool = candidates[half:]
        if rest_needed > 0 and pool:
            step = max(1, len(pool) // rest_needed)
            spaced = [pool[i * step] for i in range(rest_needed) if i * step < len(pool)]
        else:
            spaced = []
        chosen = smallest + spaced
        # de-dup while preserving order
        seen: set[Path] = set()
        for p in chosen:
            if p not in seen:
                picked.append(p)
                seen.add(p)
    return picked


def pick_from_pages() -> list[Path]:
    pages = TESTS_ROOT / "pages"
    prose_files = [
        p
        for p in pages.rglob("*.lf")
        if p.is_file()
        and eligible(p)
        and contains_prose(p)
        and line_count(p) <= MAX_PROSE_LINES
    ]
    prose_files.sort(key=lambda p: (p.stat().st_size, str(p)))
    if len(prose_files) <= PAGES_TARGET:
        return prose_files
    # evenly-spaced sample so we don't only take the smallest
    step = len(prose_files) / PAGES_TARGET
    return [prose_files[int(i * step)] for i in range(PAGES_TARGET)]


def rel_paths(paths: Iterable[Path]) -> list[str]:
    return sorted(str(p.relative_to(REPO)) for p in paths)


def main() -> int:
    if not TESTS_ROOT.exists():
        raise SystemExit(f"missing {TESTS_ROOT}")

    example_paths = pick_from_examples()
    page_paths = pick_from_pages()

    entries = rel_paths(example_paths) + rel_paths(page_paths)
    entries = sorted(set(entries))

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text("\n".join(entries) + "\n")

    sizes = [(REPO / e).stat().st_size for e in entries]
    print(
        f"wrote {len(entries)} paths → {MANIFEST.relative_to(REPO)} "
        f"(bytes: min={min(sizes)}, median={int(statistics.median(sizes))}, "
        f"max={max(sizes)})"
    )
    from_examples = sum(1 for e in entries if e.startswith("new-tests2/examples/"))
    from_pages = sum(1 for e in entries if e.startswith("new-tests2/pages/"))
    print(f"  examples/: {from_examples}   pages/: {from_pages}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
