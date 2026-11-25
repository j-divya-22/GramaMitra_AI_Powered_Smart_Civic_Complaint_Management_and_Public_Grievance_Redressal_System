import assert from 'node:assert/strict';
import test from 'node:test';
import { isCitizenComplaintEditable } from '../src/utils/complaintPermissions.js';

const pendingComplaint = {
  status: 'pending',
  assigned_admin_id: null,
  has_status_history: false,
  has_progress_updates: false,
};

test('allows citizen changes only for a submitted, unassigned complaint with no admin activity', () => {
  assert.equal(isCitizenComplaintEditable(pendingComplaint), true);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, status: 'Submitted' }), true);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, status: 'submitted' }), true);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, status: 'assigned' }), false);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, assigned_admin_id: 7 }), false);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, has_status_history: true }), false);
  assert.equal(isCitizenComplaintEditable({ ...pendingComplaint, has_progress_updates: true }), false);
});

