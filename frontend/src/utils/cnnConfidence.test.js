import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCnnConfidence } from './cnnConfidence.js';

test('formats stored CNN probabilities as percentages', () => {
  assert.equal(formatCnnConfidence('0.957616'), '95.76% CNN Confidence');
  assert.equal(formatCnnConfidence(0), '0.00% CNN Confidence');
});

test('reports missing or invalid confidence as not available', () => {
  for (const confidence of [null, undefined, '', 'not-a-number', -0.1, 1.1]) {
    assert.equal(formatCnnConfidence(confidence), 'Not available');
  }
});
