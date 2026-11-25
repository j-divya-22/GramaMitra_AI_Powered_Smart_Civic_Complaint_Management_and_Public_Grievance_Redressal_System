import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CNN_CLASS_NAMES,
  classifyImageBuffer,
  classificationFailureForReview,
  getSelectedComplaintCategory,
  isSupportedComplaintCategory,
} from '../src/services/cnnClassification.js';

test('marks unavailable CNN results for review without inventing a confidence', () => {
  assert.deepEqual(
    classificationFailureForReview({ statusCode: 503 }),
    {
      prediction: 'needs_review',
      confidence: null,
      needs_review: true,
      review_reason: 'classification_unavailable',
    }
  );
});

test('does not convert invalid-image errors into review results', () => {
  const invalidImageError = { statusCode: 400, message: 'Invalid image' };
  assert.throws(() => classificationFailureForReview(invalidImageError), (error) => error === invalidImageError);
});

test('preserves V3 prediction identifiers and confidence from the AI service', async () => {
  const originalFetch = globalThis.fetch;
  const classification = {
    prediction: 'damaged_footpath',
    confidence: 0.987654,
    model: 'civic_mobilenet_v3_v3_11',
    needs_review: false,
    review_reason: null,
    confidence_threshold: null,
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => classification,
  });

  try {
    const result = await classifyImageBuffer(Buffer.from('image bytes'), {
      filename: 'footpath.jpg',
      mimetype: 'image/jpeg',
    });
    assert.equal(result.prediction, classification.prediction);
    assert.equal(result.confidence, classification.confidence);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps the citizen-selected category separate from CNN results', () => {
  for (const category of CNN_CLASS_NAMES) {
    assert.equal(getSelectedComplaintCategory(category), category);
  }
  assert.equal(getSelectedComplaintCategory('  road_damage  '), 'road_damage');
  assert.equal(getSelectedComplaintCategory(''), null);
  assert.equal(getSelectedComplaintCategory(undefined), null);
});

test('accepts the ordered eleven CNN classes and the manual other category', () => {
  assert.deepEqual(CNN_CLASS_NAMES, [
    'damaged_footpath',
    'damaged_road_sign',
    'electrical_hazard',
    'infrastructure',
    'normal',
    'open_manhole_borewell',
    'road_damage',
    'roadside_garbage',
    'streetlight_faults',
    'vegetation',
    'waterlogging',
  ]);
  for (const category of [...CNN_CLASS_NAMES, 'other']) {
    assert.equal(isSupportedComplaintCategory(category), true);
  }
  assert.equal(isSupportedComplaintCategory('Roads & Footpaths'), false);
  assert.equal(isSupportedComplaintCategory('needs_review'), false);
});

