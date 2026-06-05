import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(new URL(import.meta.url).pathname, '../../..');
const grammarPath = path.join(repoRoot, 'grammar.js');
const termPath = path.join(repoRoot, 'lang', 'term.js');
const specPath = path.join(repoRoot, 'grammar.md');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('grammar files reference key constructs from grammar.md', () => {
  const g = read(grammarPath);
  const t = read(termPath);
  const spec = read(specPath);

  // Check that the grammar file exposes command rules and term tokens
  assert.match(g, /sort_cmd/);
  assert.match(g, /term_cmd/);
  assert.match(g, /mode_cmd/);
  assert.match(t, /expr/);
  assert.match(spec, /%term/);
});
