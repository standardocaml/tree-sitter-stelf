# Copilot instructions for tree-sitter-stelf

Purpose: quick reference for Copilot sessions working on this repository (build/test, architecture, and repository-specific conventions).

---

## Build / test / lint (how-to)

General notes:
- The project is a Tree-sitter grammar plus language bindings and native parser code. The canonical build targets are in the Makefile and binding.gyp/package.json for Node.

Native C / system build
- Full native build: `make` (produces libtree-sitter-stelf.a and shared library).  
- Clean: `make clean`  
- Install: `make install` (honors PREFIX/DESTDIR)  
- Regenerate grammar.json / C parser (uses the `tree-sitter` CLI): `tree-sitter generate` (Makefile invokes this). When editing grammar.js run `tree-sitter generate` or just `make`.
- Run tree-sitter tests (Makefile): `make test` (invokes `tree-sitter test`).

Node (bindings)
- Install & build Node addon: `npm install` (runs `node-gyp-build` via package.json `install` script). Use `npm ci` for CI installs.
- Build WASM parser: `npm run prestart` or run `tree-sitter build --wasm` directly.
- Playground: `npm start` (runs `tree-sitter playground`).
- Run Node tests (all): `npm test` (runs `node --test bindings/node/*_test.js`).
- Run a single Node test: `node --test bindings/node/binding_test.js` or `node --test bindings/node/grammar_file_test.js`.

Python (bindings)
- Tests use Python unittest. Run single Python test: `python -m unittest bindings/python/tests/test_binding.py`.
- The Python binding expects the compiled grammar module (build via `make` / `tree-sitter build`).

Linting
- No dedicated linter or lint script is present in package.json. Follow language-appropriate linters if added later.

---

## High-level architecture

- Root-level grammar: `grammar.js` is the entry-point Tree-sitter DSL grammar. It composes rules from modular files under `lang/` (notably `lang/term.js`).
- Specification: `grammar.md` contains the human-readable specification / reference that tests assert against. Treat it as authoritative for language semantics.
- Generated parser sources: `src/` contains the C parser (`parser.c`) and optional `scanner.c` produced by `tree-sitter generate`.
- Native build: `Makefile` and `bindings/c` contain install rules and packaging. `binding.gyp` and `bindings/node/` implement the Node addon build.
- Bindings: `bindings/node/`, `bindings/python/`, `bindings/zig/` (and others) provide language-specific wrappers around the core parser library.
- Tests & examples: `test/` (corpora), `bindings/*/*_test.js`, and `prebuilds/` / `output/` contain prebuilt artifacts and example outputs.

Workflow summary for a grammar change:
1. Edit `grammar.js` and supporting modules in `lang/`.
2. Run `tree-sitter generate` or `make` to regenerate `src/parser.c` and `src/grammar.json`.
3. Rebuild bindings (e.g., `npm install`) and run binding tests (`node --test ...`) and `make test` if needed.

---

## Key conventions and repository-specific patterns

- Modular grammar: tokens and term-level rules live in `lang/` and are spread into the top-level `grammar.js` using spread (`...term`). Keep small, focused modules per language-level concept.
- `grammar.md` is used by tests to verify the grammar exports/uses key constructs. When changing public-facing tokens or command names, update `grammar.md` accordingly and run `bindings/node/grammar_file_test.js`.
- Do not hand-edit generated files in `src/` (e.g., `parser.c`) — they are produced by `tree-sitter generate`.
- Node addon uses `node-addon-api` and `node-gyp-build` (see `binding.gyp` and package.json `install`), so Node builds are driven via npm install/node-gyp.
- WASM build: project includes a `prestart` script (runs `tree-sitter build --wasm`) to create `.wasm` builds used by prebuilt artifacts.
- Tests:
  - Node tests use the built-in Node test runner (`node --test`) and live under `bindings/node/`.
  - Python tests use `unittest` under `bindings/python/tests/`.
  - Corpus samples live in `test/corpus/` and are useful for regression checks.
- Queries: `queries/*.scm` (if present) are installed into the tree-sitter queries share directory by the Makefile.
- Packaging: `prebuilds/` may contain platform-specific build artifacts; `prebuildify` is listed in devDependencies to support prebuilds.

---

## Quick references for Copilot sessions

- If a change touches grammar tokens/rules: mention `grammar.js`, `lang/*`, and `grammar.md` in the same context so Copilot understands intent across files.
- For build/test automation snippets: prefer `make` for native artifacts and `npm install` / `node --test` for Node-level checks; for a single quick Node test use `node --test <path>`.
- When suggesting edits to grammar: include `tree-sitter generate` (or `make`) and a note to re-run binding tests.

---

Files to check first when exploring:
- `grammar.js`, `lang/term.js`, `grammar.md`, `Makefile`, `binding.gyp`, `package.json`, `bindings/node/*`, `bindings/python/*`, `test/corpus/`.

----

(End of Copilot instructions)
