import test from 'node:test';
import assert from 'node:assert/strict';
import { toTable } from '../src/format.js';

test('toTable renders headers and rows', () => {
  const table = toTable([{ id: '1', name: 'Test' }], ['id', 'name']);
  assert.match(table, /id/);
  assert.match(table, /name/);
  assert.match(table, /Test/);
});
