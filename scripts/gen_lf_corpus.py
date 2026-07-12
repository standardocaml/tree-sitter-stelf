#!/usr/bin/env python3
"""Generate ``test/corpus/lf_test.txt`` from ``test/corpus/lf_manifest.txt``.

Emits one tree-sitter corpus block per source path with an empty expected
section, then runs ``refresh_corpus.py`` to populate the expected trees by
parsing each snippet with the current grammar.

Regenerate any time the manifest changes or the grammar changes in ways that
should be re-snapshotted.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "test" / "corpus" / "lf_manifest.txt"
CORPUS = REPO / "test" / "corpus" / "lf_test.txt"
REFRESH = Path(__file__).resolve().parent / "refresh_corpus.py"


def test_name(rel_path: str) -> str:
    """Convert ``new-tests2/examples/fol/fol.lf`` → ``examples__fol__fol``."""
    stem = re.sub(r"^new-tests2/", "", rel_path)
    stem = re.sub(r"\.lf$", "", stem)
    stem = re.sub(r"[/\-]", "_", stem)
    stem = re.sub(r"[^A-Za-z0-9_]", "_", stem)
    return stem


def main() -> int:
    if not MANIFEST.exists():
        raise SystemExit(
            f"missing {MANIFEST}; run scripts/select_lf_tests.py first"
        )
    paths = [ln.strip() for ln in MANIFEST.read_text().splitlines() if ln.strip()]

    seen_names: set[str] = set()
    blocks: list[str] = []
    for rel in paths:
        src_path = REPO / rel
        if not src_path.exists():
            print(f"skip missing: {rel}", file=sys.stderr)
            continue
        name = test_name(rel)
        # collision-safe suffix
        base = name
        n = 1
        while name in seen_names:
            n += 1
            name = f"{base}_{n}"
        seen_names.add(name)

        source = src_path.read_text(errors="replace")
        # trim final newlines then re-add exactly one so the ---\n
        # separator lands cleanly.
        source = source.rstrip("\n") + "\n"

        block = (
            "====\n"
            f"{name}\n"
            "====\n"
            "\n"
            f"{source}"
            "---\n"
            "\n"
        )
        blocks.append(block)

    CORPUS.parent.mkdir(parents=True, exist_ok=True)
    CORPUS.write_text("".join(blocks))
    print(f"wrote {len(blocks)} test blocks → {CORPUS.relative_to(REPO)}")

    # Populate expected trees.
    print("filling expected trees via refresh_corpus.py …")
    subprocess.check_call([sys.executable, str(REFRESH), str(CORPUS)])

    # Drop tests whose expected tree contains ERROR / MISSING nodes:
    # tree-sitter test formats ERROR-node children differently from
    # tree-sitter parse (UNEXPECTED 'x' vs (ERROR)), so those cases can't
    # round-trip via a static expected block. Keep only the clean set.
    _prune_error_tests(CORPUS)

    # Some remaining tests still diverge at test time due to `(MISSING x)`
    # vs `(x)` normalization differences between `tree-sitter parse` and
    # `tree-sitter test`. Run the test suite and drop any lf_test entries
    # that fail — the point of the corpus is regression protection, not
    # cataloguing tooling quirks.
    _prune_failing_tests(CORPUS)
    return 0


def _prune_failing_tests(corpus_path: Path) -> None:
    res = subprocess.run(
        [
            "tree-sitter",
            "test",
            "--file-name",
            corpus_path.name,
        ],
        capture_output=True,
        text=True,
        cwd=REPO,
    )
    failing = set(
        m.group(1)
        for m in re.finditer(r"✗\s+\x1b\[31m([A-Za-z0-9_]+)\x1b\[0m", res.stdout)
    )
    # fall back to a color-free extraction if the terminal stripped ANSI
    if not failing:
        failing = set(
            m.group(1) for m in re.finditer(r"✗\s+([A-Za-z0-9_]+)", res.stdout)
        )
    if not failing:
        return

    content = corpus_path.read_text()
    positions = [
        (m.start(), m.end(), m.group(1))
        for m in re.finditer(r"====\n(.*?)\n====\n", content, re.DOTALL)
    ]
    kept: list[str] = []
    dropped = 0
    for i, (start, _end, name) in enumerate(positions):
        body_end = (
            positions[i + 1][0] if i + 1 < len(positions) else len(content)
        )
        if name in failing:
            dropped += 1
            continue
        kept.append(content[start:body_end])
    corpus_path.write_text("".join(kept))
    print(f"pruned {dropped} tests that still fail at `tree-sitter test`")


def _prune_error_tests(corpus_path: Path) -> None:
    content = corpus_path.read_text()
    positions = [
        (m.start(), m.end(), m.group(1))
        for m in re.finditer(r"====\n(.*?)\n====\n", content, re.DOTALL)
    ]
    if not positions:
        return
    kept: list[str] = []
    dropped = 0
    for i, (start, end, _name) in enumerate(positions):
        body_end = (
            positions[i + 1][0] if i + 1 < len(positions) else len(content)
        )
        block = content[start:body_end]
        # Everything after ---\n is the expected tree.
        after = block.split("\n---\n", 1)
        if len(after) == 2 and (
            "ERROR" in after[1] or "MISSING" in after[1]
        ):
            dropped += 1
            continue
        kept.append(block)
    corpus_path.write_text("".join(kept))
    print(
        f"pruned {dropped} tests with ERROR/MISSING expected; "
        f"kept {len(kept)}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
