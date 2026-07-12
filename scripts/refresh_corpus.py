#!/usr/bin/env python3
"""Refresh expected CST blocks in a tree-sitter corpus file.

Like ``fill_corpus.py`` but overwrites existing expected trees instead of
only filling blank ones. Use after a grammar or scanner change that
legitimately alters output for stored tests.

Usage:
    python scripts/refresh_corpus.py <path/to/corpus.txt> [more paths...]
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile


TEST_SEP_RE = re.compile(r"====\n(.*?)\n====\n", re.DOTALL)
RESULT_SEP = "\n---\n"


def strip_coords(cst: str) -> str:
    cst = re.sub(r" \[\d+, \d+\] - \[\d+, \d+\]", "", cst)
    cst = re.sub(r"\n?/[^\n]+\.stelf\tParse:[^\n]*", "", cst)
    return cst.rstrip("\n")


def parse_input(text: str) -> str:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".stelf", delete=False
    ) as f:
        f.write(text)
        tmp = f.name
    try:
        res = subprocess.run(
            ["tree-sitter", "parse", tmp], capture_output=True, text=True
        )
        return strip_coords(res.stdout)
    finally:
        os.unlink(tmp)


def refresh_file(path: str) -> tuple[int, int]:
    """Return (n_refreshed, n_with_errors)."""
    with open(path) as f:
        content = f.read()

    positions = [
        (m.start(), m.end(), m.group(1)) for m in TEST_SEP_RE.finditer(content)
    ]
    if not positions:
        return 0, 0

    out: list[str] = []
    prev_end = 0
    n = 0
    n_err = 0
    for i, (start, end, name) in enumerate(positions):
        out.append(content[prev_end:start])
        body_end = positions[i + 1][0] if i + 1 < len(positions) else len(content)
        header = content[start:end]
        body = content[end:body_end]

        if RESULT_SEP not in body:
            # malformed — leave alone
            out.append(header + body)
            prev_end = body_end
            continue

        sep_idx = body.index(RESULT_SEP)
        input_text = body[:sep_idx]
        cst = parse_input(input_text)
        has_error = "ERROR" in cst or "MISSING" in cst
        n += 1
        if has_error:
            n_err += 1

        new_body = input_text + RESULT_SEP + "\n" + cst + "\n"
        # preserve any trailing blank line before next test
        if body_end < len(content) and content[body_end - 1] != "\n":
            new_body += "\n"
        out.append(header + new_body)
        prev_end = body_end

    out.append(content[prev_end:])
    with open(path, "w") as f:
        f.write("".join(out))
    return n, n_err


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="+", help="corpus file(s) to refresh")
    args = ap.parse_args()

    for p in args.paths:
        if not os.path.exists(p):
            print(f"skip (missing): {p}", file=sys.stderr)
            continue
        n, n_err = refresh_file(p)
        base = os.path.basename(p)
        print(f"{base}: refreshed {n} tests ({n_err} contain ERROR)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
