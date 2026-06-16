#!/usr/bin/env python3
"""Generate tree-sitter corpus test files from Cases.ml snippets."""

import re
import subprocess
import tempfile
import os
import sys

CASES_ML = os.path.join(os.path.dirname(__file__), "Cases.ml")
CORPUS_DIR = os.path.join(os.path.dirname(__file__), "test", "corpus")


def parse_cases_ml(path):
    """Parse Cases.ml and return a dict of name -> STELF string."""
    with open(path) as f:
        src = f.read()

    bindings = {}

    # Scan character-by-character to find all let bindings.
    # OCaml raw string syntax: {| ... |} where content may contain { and } freely,
    # but not the two-char sequence |}. We find {| then search for |}.
    let_name_pat = re.compile(r'let\s+(\w+)\s*=\s*', re.MULTILINE)
    raw_open = '{|'
    raw_close = '|}'

    i = 0
    while i < len(src):
        m = let_name_pat.match(src, i)
        if not m:
            # advance one char and retry
            i += 1
            continue
        name = m.group(1)
        after = m.end()
        # skip whitespace/newlines to find what follows
        j = after
        while j < len(src) and src[j] in ' \t\n':
            j += 1
        if src[j:j+2] == raw_open:
            # raw string literal
            start = j + 2
            end = src.find(raw_close, start)
            if end == -1:
                i = after
                continue
            content = src[start:end]
            bindings[name] = content
            i = end + 2
        else:
            i = after

    # Second pass: resolve composites (let name = a ^ b ^ c)
    comp_pat = re.compile(r'^let\s+(\w+)\s*=\s*([\w][\w\s\^]*)$', re.MULTILINE)
    changed = True
    while changed:
        changed = False
        for m in comp_pat.finditer(src):
            name = m.group(1)
            if name in bindings:
                continue
            rhs = m.group(2).strip()
            if '^' not in rhs:
                continue
            parts = [p.strip() for p in rhs.split('^')]
            if all(p in bindings for p in parts):
                bindings[name] = ''.join(bindings[p] for p in parts)
                changed = True

    return bindings


def write_corpus(path, tests):
    """Write a list of (name, stelf_code) to a corpus file with empty expected output.
    Run `tree-sitter test --update` afterwards to fill in the actual parse trees."""
    parts = []
    for name, code in tests:
        block = f"====\n{name}\n====\n{code}\n----\n\n"
        parts.append(block)
        print(f"  [{path.split('/')[-1]}] {name}")
    with open(path, 'w') as f:
        f.write('\n'.join(parts) + '\n')


def main():
    bindings = parse_cases_ml(CASES_ML)
    print(f"Loaded {len(bindings)} bindings from Cases.ml")

    # ---------- corpus file definitions ----------
    corpus_files = {
        "fol.txt": [
            ("fol1", bindings.get("fol1", "")),
            ("fol2", bindings.get("fol2", "")),
            ("fol3", bindings.get("fol3", "")),
            ("fol4", bindings.get("fol4", "")),
            ("fol5", bindings.get("fol5", "")),
            ("fol6", bindings.get("fol6", "")),
        ],
        "lam.txt": [
            ("lam_1", bindings.get("lam_1", "")),
            ("lam_2", bindings.get("lam_2", "")),
            ("lam_3", bindings.get("lam_3", "")),
            ("lam_4", bindings.get("lam_4", "")),
            ("lam_5", bindings.get("lam_5", "")),
            ("polylam", bindings.get("polylam", "")),
        ],
        "zf.txt": [
            ("zf_1", bindings.get("zf_1", "")),
            ("zf_2", bindings.get("zf_2", "")),
            ("zf_3", bindings.get("zf_3", "")),
            ("zf_4", bindings.get("zf_4", "")),
            ("zf_5", bindings.get("zf_5", "")),
            ("zf_6", bindings.get("zf_6", "")),
        ],
        "nats.txt": [
            ("nats1", bindings.get("nats1", "")),
            ("nats2", bindings.get("nats2", "")),
            ("nats3", bindings.get("nats3", "")),
            ("nats4", bindings.get("nats4", "")),
        ],
        "jsf.txt": [
            ("jsf_1", bindings.get("jsf_1", "")),
            ("jsf_2_1", bindings.get("jsf_2_1", "")),
            ("jsf_2_2", bindings.get("jsf_2_2", "")),
            ("jsf_3", bindings.get("jsf_3", "")),
            ("jsf_4", bindings.get("jsf_4", "")),
        ],
        "prop.txt": [
            ("prop_calc_types", bindings.get("prop_calc_types", "")),
            ("prop_calc_hilbert", bindings.get("prop_calc_hilbert", "")),
            ("prop_calc_nd", bindings.get("prop_calc_nd", "")),
        ],
        "mini-ml.txt": [
            ("mini_ml_exp", bindings.get("mini_ml_exp", "")),
            ("mini_ml_value", bindings.get("mini_ml_value", "")),
            ("mini_ml_tp", bindings.get("mini_ml_tp", "")),
            ("mini_ml_sources_eval", bindings.get("mini_ml_sources_eval", "")),
            ("mini_ml_sources_tpinf", bindings.get("mini_ml_sources_tpinf", "")),
        ],
        "arithmetic.txt": [
            ("arith_nat", bindings.get("arith_nat", "")),
            ("arith_nt", bindings.get("arith_nt", "")),
            ("arith_plus", bindings.get("arith_plus", "")),
            ("arith_acker", bindings.get("arith_acker", "")),
        ],
        "guide.txt": [
            ("guide_lists_types", bindings.get("guide_lists_types", "")),
            ("guide_lists_append", bindings.get("guide_lists_append", "")),
            ("guide_lists_mode", bindings.get("guide_lists_mode", "")),
            ("guide_nd", bindings.get("guide_nd", "")),
        ],
        "tapl.txt": [
            ("tapl_nat_base", bindings.get("tapl_nat_base", "")),
            ("tapl_nat_eq", bindings.get("tapl_nat_eq", "")),
            ("tapl_defs_types", bindings.get("tapl_defs_types", "")),
            ("tapl_defs_labels", bindings.get("tapl_defs_labels", "")),
            ("tapl_defs_exp", bindings.get("tapl_defs_exp", "")),
            ("tapl_defs_value", bindings.get("tapl_defs_value", "")),
            ("tapl_defs_store", bindings.get("tapl_defs_store", "")),
            ("tapl_defs_heap", bindings.get("tapl_defs_heap", "")),
        ],
        "logic-prog.txt": [
            ("lp_horn_nd", bindings.get("lp_horn_nd", "")),
            ("lp_horn_sources_2", bindings.get("lp_horn_sources_2", "")),
            ("lp_horn_sources_3", bindings.get("lp_horn_sources_3", "")),
        ],
        "church-rosser.txt": [
            ("church_rosser_lam", bindings.get("church_rosser_lam", "")),
            ("church_rosser_sources_2", bindings.get("church_rosser_sources_2", "")),
            ("church_rosser_sources_3", bindings.get("church_rosser_sources_3", "")),
        ],
        "stlc.txt": [
            ("small_step_lam_types", bindings.get("small_step_lam_types", "")),
            ("small_step_lam_terms", bindings.get("small_step_lam_terms", "")),
            ("small_step_lam_typing", bindings.get("small_step_lam_typing", "")),
            ("small_step_lam_value", bindings.get("small_step_lam_value", "")),
            ("small_step_lam_step", bindings.get("small_step_lam_step", "")),
            ("crary_excon", bindings.get("crary_excon", "")),
            ("crary_excon_rev_syntax", bindings.get("crary_excon_rev_syntax", "")),
        ],
        "system-f.txt": [
            ("small_step_sysf_types", bindings.get("small_step_sysf_types", "")),
            ("small_step_sysf_terms", bindings.get("small_step_sysf_terms", "")),
            ("small_step_sysf_typing", bindings.get("small_step_sysf_typing", "")),
            ("small_step_sysf_value", bindings.get("small_step_sysf_value", "")),
            ("small_step_sysf_step", bindings.get("small_step_sysf_step", "")),
            ("small_step_sysf_iso_types", bindings.get("small_step_sysf_iso_types", "")),
            ("small_step_sysf_iso_terms", bindings.get("small_step_sysf_iso_terms", "")),
            ("small_step_sysf_iso_typing", bindings.get("small_step_sysf_iso_typing", "")),
            ("small_step_sysf_iso_value", bindings.get("small_step_sysf_iso_value", "")),
            ("small_step_sysf_iso_step", bindings.get("small_step_sysf_iso_step", "")),
        ],
        "poplmark.txt": [
            ("poplmark_1a_syntax", bindings.get("poplmark_1a_syntax", "")),
            ("poplmark_2a_syntax", bindings.get("poplmark_2a_syntax", "")),
            ("poplmark_1b_syntax", bindings.get("poplmark_1b_syntax", "")),
            ("poplmark_2b_syntax", bindings.get("poplmark_2b_syntax", "")),
        ],
        "categories.txt": [
            ("ccc_syntax", bindings.get("ccc_syntax", "")),
            ("ccc_spass_1", bindings.get("ccc_spass_1", "")),
        ],
        "linear.txt": [
            ("incll_syntax", bindings.get("incll_syntax", "")),
            ("crary_linear_syntax", bindings.get("crary_linear_syntax", "")),
            ("crary_linear_linear", bindings.get("crary_linear_linear", "")),
            ("crary_lineard_syntax", bindings.get("crary_lineard_syntax", "")),
        ],
        "modal.txt": [
            ("crary_modal_syntax", bindings.get("crary_modal_syntax", "")),
        ],
        "cut-elim.txt": [
            ("cut_elim_formulas", bindings.get("cut_elim_formulas", "")),
            ("cut_elim_sources_2", bindings.get("cut_elim_sources_2", "")),
        ],
        "cps.txt": [
            ("cpsocc_dsbnf", bindings.get("cpsocc_dsbnf", "")),
            ("cpsocc_cpsBNF", bindings.get("cpsocc_cpsBNF", "")),
        ],
    }

    for filename, tests in corpus_files.items():
        path = os.path.join(CORPUS_DIR, filename)
        # Filter out empty bindings
        tests = [(n, c) for n, c in tests if c.strip()]
        if not tests:
            print(f"  SKIP {filename} — no bindings found")
            continue
        write_corpus(path, tests)

    print("\nDone.")


if __name__ == "__main__":
    main()
