import assert from 'node:assert/strict';

const pointValue = 10;
const buildReward = (complaintStatus, alreadyRewarded) => {
  if (alreadyRewarded) return null;
  const submission = { type: 'submission', points: 1, amount: pointValue };
  if (complaintStatus !== 'resolved') return submission;
  const resolution = { type: 'resolution', points: 1, amount: pointValue };
  return [submission, resolution];
};

assert.deepEqual(buildReward('pending', false), {
  type: 'submission',
  points: 1,
  amount: 10,
});
assert.deepEqual(buildReward('resolved', false), [
  { type: 'submission', points: 1, amount: 10 },
  { type: 'resolution', points: 1, amount: 10 },
]);
assert.equal(buildReward('resolved', true), null);
assert.equal(buildReward('assigned', false).type, 'submission');
assert.equal(buildReward('in_progress', false).type, 'submission');
assert.equal(buildReward('rejected', false).type, 'submission');

const sevenComplaints = [
  ...Array.from({ length: 5 }, () => [buildReward('pending', false)]),
  ...Array.from({ length: 2 }, () => buildReward('resolved', false)),
];
const totalPoints = sevenComplaints.flat().reduce((points, reward) => points + reward.points, 0);
const totalAmount = sevenComplaints.flat().reduce((amount, reward) => amount + reward.amount, 0);
assert.equal(totalPoints, 9);
assert.equal(totalAmount, 90);

console.log(JSON.stringify({
  unresolvedSubmissionReward: '1 point / ₹10',
  resolvedComplaintReward: '2 points / ₹20',
  sevenSubmittedTwoResolved: '9 points / ₹90',
  duplicateSubmissionAndResolutionBlocked: true,
  eligibilityRule: 'Six calendar months',
}, null, 2));
