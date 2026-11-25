import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPLAINT_CATEGORY_LABELS,
  getCitizenComplaintCategoryLabel,
  getComplaintCategoryLabel,
} from './complaintCategory.js';

test('maps each V3 identifier to its exact user-friendly label', () => {
  const expectedLabels = {
    damaged_footpath: 'Damaged Footpath',
    damaged_road_sign: 'Damaged or Missing Road Sign',
    electrical_hazard: 'Loose / Open Electric Wires',
    infrastructure: 'Damaged Public Infrastructure',
    normal: 'No Civic Issue',
    open_manhole_borewell: 'Open Manhole / Borewell / Deep Hole',
    road_damage: 'Damaged Road / Holes on Road',
    roadside_garbage: 'Garbage on Roadside / Public Places',
    streetlight_faults: 'Streetlight Not Working',
    vegetation: 'Overgrown Trees / Bushes / Plants',
    waterlogging: 'Waterlogging / Flooded Road',
  };

  assert.deepEqual(
    Object.fromEntries(Object.keys(expectedLabels).map((id) => [id, COMPLAINT_CATEGORY_LABELS[id]])),
    expectedLabels
  );
  for (const [id, label] of Object.entries(expectedLabels)) {
    assert.equal(getCitizenComplaintCategoryLabel(id), label);
    assert.equal(getComplaintCategoryLabel(id), label);
  }
});
