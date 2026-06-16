# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A [tree-sitter](https://tree-sitter.github.io/) grammar for **STELF** (System for Totality in the Edinburgh Logical Framework), a dependently-typed logical framework language. The grammar targets the *modern* STELF surface syntax (not legacy Twelf syntax). `grammar.md` is the authoritative language specification — treat it as ground truth when the grammar and the spec diverge.

## Commands

### Grammar & native build
```bash
tree-sitter generate          # regenerate src/grammar.json and src/parser.c from grammar.js
make                          # full native build (libtree-sitter-stelf.a + shared library)
make test                     # run tree-sitter corpus tests (test/corpus/*.txt)
make clean
```

### Node bindings
```bash
npm install                   # build Node addon (runs node-gyp-build)
npm test                      # run all Node binding tests
node --test bindings/node/binding_test.js      # single Node test
node --test bindings/node/grammar_file_test.js # single Node test
```

### WASM & playground
```bash
npm run prestart              # build .wasm (tree-sitter build --wasm)
npm start                     # launch tree-sitter playground
```

### Python binding
```bash
python -m unittest bindings/python/tests/test_binding.py
```

## Workflow for grammar changes

1. Edit `grammar.js` and/or `lang/term.js`.
2. Run `tree-sitter generate` (or `make`) to regenerate `src/parser.c` and `src/grammar.json`.
3. Run `make test` for corpus tests and `npm test` for binding tests.
4. **Do not hand-edit** `src/parser.c` or `src/grammar.json` — they are generated artifacts.

## Architecture

```
grammar.js          # top-level tree-sitter grammar; imports from lang/
lang/term.js        # term-level rules (expr, decl, mode, order, …) spread into grammar.js
src/parser.c        # generated C parser (do not edit)
src/grammar.json    # generated grammar snapshot (do not edit)
test/corpus/        # tree-sitter corpus tests (plain text, ===name=== / --- / CST format)
bindings/           # language bindings: node/, python/, zig/, c/, …
grammar.md          # human-readable BNF spec + tree-sitter design notes
```

`grammar.js` uses ES module `import` and spreads `lang/term.js` via `...term` into its `rules` object. The two files together define the complete grammar.

## Key language facts (for writing/debugging grammar rules)

- **Everything `%`-prefixed is a keyword**; bare identifiers (`nat`, `+`, `<=`, `add/zero`, `_X`) are all the same `ident` token — never split identifiers into alphanumeric vs symbolic.
- **Keyword boundary**: `%term` must not match the prefix of `%terminates`. Use a lookahead regex `(?=[\s(){}\[\]%]|$)` after the keyword body (see `grammar.md §16.1`).
- **Uppercase vs lowercase** is determined by the first character (`_` or `A–Z` → uppercase/metavariable) in the *consumer*, not the lexer — the grammar keeps a single `ident` token.
- **Statement boundary**: commands are delimited by the *start* of the next `%`-word. Anything between commands that is not `%` is `outer_text` and is silently skipped.
- **`%{` / `%}`** (not bare `{`/`}`) delimit command-list blocks in `%module` and `%eval`. Bare `{`/`}` are Pi binders in terms.
- **`%prec` is stateful** and not fully expressible in the static grammar — parse application as a flat sequence and defer precedence resolution downstream (see `grammar.md §16.4`).
- **Comments** (`% line`, `%{ block %}`) are modelled as `extras` so they are absorbed wherever whitespace is allowed. The modern STELF parser itself does not currently consume comments, but the tree-sitter grammar should be forward-compatible.
