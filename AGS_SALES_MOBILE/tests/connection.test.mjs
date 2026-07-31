import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApiBaseUrl } from '../src/lib/connection.js';

test('buildApiBaseUrl adds /api when missing', () => {
  assert.equal(buildApiBaseUrl('https://api1.assiagroupsolutions.com.co'), 'https://api1.assiagroupsolutions.com.co/api/');
});

test('buildApiBaseUrl preserves an existing /api suffix', () => {
  assert.equal(buildApiBaseUrl('https://api1.assiagroupsolutions.com.co/api'), 'https://api1.assiagroupsolutions.com.co/api/');
});

test('buildApiBaseUrl trims trailing slash', () => {
  assert.equal(buildApiBaseUrl('https://api1.assiagroupsolutions.com.co/api/'), 'https://api1.assiagroupsolutions.com.co/api/');
});
