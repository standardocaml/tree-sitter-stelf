#!/usr/bin/env python3
"""Fill in empty expected outputs in corpus files by running tree-sitter parse on the exact input."""

import re
import subprocess
import tempfile
import os

CORPUS_DIR = os.path.join(os.path.dirname(__file__), "test", "corpus")

TARGET_FILES = [
    "fol.txt", "lam.txt", "zf.txt", "nats.txt", "jsf.txt", "prop.txt",
    "mini-ml.txt", "arithmetic.txt", "guide.txt", "tapl.txt", "logic-prog.txt",
    "church-rosser.txt", "stlc.txt", "system-f.txt", "poplmark.txt",
    "categories.txt", "linear.txt", "modal.txt", "cut-elim.txt", "cps.txt",
]


def strip_coords(cst):
    cst = re.sub(r' \[\d+, \d+\] - \[\d+, \d+\]', '', cst)
    cst = re.sub(r'\n?/[^\n]+\.stelf\tParse:[^\n]*', '', cst)
    return cst.rstrip('\n')


def parse_input(text):
    """Parse a STELF string and return the CST without coordinates."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.stelf', delete=False) as f:
        f.write(text)
        tmp = f.name
    try:
        result = subprocess.run(['tree-sitter', 'parse', tmp], capture_output=True, text=True)
        return strip_coords(result.stdout)
    finally:
        os.unlink(tmp)


def fill_file(path):
    """Fill in empty expected outputs in a corpus file."""
    with open(path) as f:
        content = f.read()

    # Split into individual tests: separator is ====\nname\n====\n
    # We'll process the file as a sequence of test blocks.
    # A block starts with ====\nname\n==== and ends before the next ==== or EOF.

    test_sep = re.compile(r'====\n(.*?)\n====\n', re.DOTALL)
    result_sep = '\n----\n'

    # Find all test positions
    positions = [(m.start(), m.end(), m.group(1)) for m in test_sep.finditer(content)]

    if not positions:
        return

    new_content_parts = []
    prev_end = 0

    for i, (start, end, name) in enumerate(positions):
        # Add any content before this test's header
        new_content_parts.append(content[prev_end:start])

        # Find where this test's body ends (next test or EOF)
        if i + 1 < len(positions):
            body_end = positions[i + 1][0]
        else:
            body_end = len(content)

        header = content[start:end]
        body = content[end:body_end]

        # Split body at ----
        if result_sep in body:
            sep_idx = body.index(result_sep)
            input_text = body[:sep_idx]
            rest = body[sep_idx + len(result_sep):]
            # rest is "\n\n" or "\n<CST>\n\n..."
            # Check if rest has non-empty expected output (more than just whitespace)
            expected = rest.lstrip('\n').rstrip('\n').rstrip()
        else:
            # No ---- separator - malformed
            new_content_parts.append(header + body)
            prev_end = body_end
            continue

        if expected:
            # Already has expected output - keep as is
            new_content_parts.append(header + body)
        else:
            # Empty expected - fill it in
            cst = parse_input(input_text)
            has_error = 'ERROR' in cst or 'MISSING' in cst
            new_body = input_text + result_sep + '\n' + cst + '\n'
            # Preserve any trailing blank line before next test
            if body_end < len(content) and content[body_end - 1] != '\n':
                new_body += '\n'
            new_content_parts.append(header + new_body)
            status = 'HAS ERRORS' if has_error else 'OK'
            print(f"  {name}: {status}")

        prev_end = body_end

    new_content_parts.append(content[prev_end:])
    new_content = ''.join(new_content_parts)

    with open(path, 'w') as f:
        f.write(new_content)


def main():
    for filename in TARGET_FILES:
        path = os.path.join(CORPUS_DIR, filename)
        if not os.path.exists(path):
            continue
        print(f"Processing {filename}...")
        fill_file(path)
    print("\nDone.")


if __name__ == '__main__':
    main()
