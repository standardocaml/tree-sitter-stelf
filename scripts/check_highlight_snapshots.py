#!/usr/bin/env python3
"""Verify that committed highlight snapshots match current output.

Regenerates snapshots into a scratch directory, diffs against the committed
``.hl`` files, and reports drift. Exits non-zero on any mismatch so CI /
``make snapshots`` catches regressions in the grammar, scanner, or
``queries/highlights.scm``.

Usage::

    python scripts/check_highlight_snapshots.py
"""

from __future__ import annotations

import difflib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HIGHLIGHT_DIR = REPO / "test" / "highlight"
SNAPSHOT_DIR = REPO / "test" / "highlight-snapshots"
GEN = Path(__file__).resolve().parent / "gen_highlight_snapshots.py"


def _files(directory: Path, ext: str) -> list[Path]:
    return sorted(directory.glob(f"*{ext}"))


def _diff(a: Path, b: Path) -> str:
    ta = a.read_text().splitlines(keepends=True) if a.exists() else []
    tb = b.read_text().splitlines(keepends=True) if b.exists() else []
    return "".join(
        difflib.unified_diff(ta, tb, fromfile=str(a), tofile=str(b), n=2)
    )


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        scratch_hl = tmp_path / "highlight"
        scratch_snap = tmp_path / "highlight-snapshots"
        # Copy sources for curated (`.stelf`) so the generator has inputs.
        scratch_hl.mkdir()
        for src in HIGHLIGHT_DIR.glob("*.stelf"):
            shutil.copy(src, scratch_hl / src.name)

        # Run the generator, redirecting its outputs to scratch dirs by
        # temporarily rewiring the constants in a subprocess env-style call.
        # Simplest correct approach: regenerate in-place, back up committed
        # first, then compare + restore.
        backup = tmp_path / "backup"
        backup.mkdir()
        (backup / "highlight").mkdir()
        (backup / "highlight-snapshots").mkdir()
        for f in _files(HIGHLIGHT_DIR, ".hl"):
            shutil.copy(f, backup / "highlight" / f.name)
        for f in _files(SNAPSHOT_DIR, ".hl"):
            shutil.copy(f, backup / "highlight-snapshots" / f.name)

        try:
            subprocess.check_call([sys.executable, str(GEN)])
            diffs: list[str] = []

            for f in _files(HIGHLIGHT_DIR, ".hl"):
                original = backup / "highlight" / f.name
                if not original.exists():
                    diffs.append(f"NEW: {f.relative_to(REPO)}\n")
                    continue
                d = _diff(original, f)
                if d:
                    diffs.append(d)
            for f in _files(backup / "highlight", ".hl"):
                if not (HIGHLIGHT_DIR / f.name).exists():
                    diffs.append(f"REMOVED: highlight/{f.name}\n")

            for f in _files(SNAPSHOT_DIR, ".hl"):
                original = backup / "highlight-snapshots" / f.name
                if not original.exists():
                    diffs.append(f"NEW: {f.relative_to(REPO)}\n")
                    continue
                d = _diff(original, f)
                if d:
                    diffs.append(d)
            for f in _files(backup / "highlight-snapshots", ".hl"):
                if not (SNAPSHOT_DIR / f.name).exists():
                    diffs.append(f"REMOVED: highlight-snapshots/{f.name}\n")

        finally:
            # Restore committed snapshots regardless of check outcome, so the
            # working tree isn't left mutated by a verification run.
            for f in HIGHLIGHT_DIR.glob("*.hl"):
                f.unlink()
            for f in SNAPSHOT_DIR.glob("*.hl"):
                f.unlink()
            for f in (backup / "highlight").glob("*.hl"):
                shutil.copy(f, HIGHLIGHT_DIR / f.name)
            for f in (backup / "highlight-snapshots").glob("*.hl"):
                shutil.copy(f, SNAPSHOT_DIR / f.name)

    if diffs:
        sys.stdout.write("".join(diffs))
        print(
            f"\nhighlight snapshot drift: {len(diffs)} file(s) differ. "
            "Rerun `python scripts/gen_highlight_snapshots.py` to update.",
            file=sys.stderr,
        )
        return 1

    print("highlight snapshots OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
