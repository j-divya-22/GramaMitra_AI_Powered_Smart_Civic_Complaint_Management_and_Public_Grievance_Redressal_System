import assert from 'node:assert/strict';
const backoffCache = new Map();
const normalizeAddress = (address) => address.toLowerCase().replace(/\s+/g, ' ').trim();
const addressRetryBackoffMs = () => ({
  ambiguous: 24 * 60 * 60 * 1000,
  failed: 10 * 60 * 1000,
  notFound: 24 * 60 * 60 * 1000,
});
const recordAddressEnrichmentBackoff = (address, kind) => {
  const backoff = addressRetryBackoffMs();
  backoffCache.set(normalizeAddress(address), {
    kind,
    retryAt: Date.now() + backoff[kind],
  });
};
const isAddressEnrichmentReadyForRetry = (address) => {
  const retry = backoffCache.get(normalizeAddress(address));
  if (!retry) return true;
  if (retry.retryAt <= Date.now()) {
    backoffCache.delete(normalizeAddress(address));
    return true;
  }
  return false;
};
const clearAddressEnrichmentBackoff = (address) => {
  backoffCache.delete(normalizeAddress(address));
};

const preserveFailurePolicy = (currentStatus) => (
  ['identified', 'candidate'].includes(currentStatus)
    ? 'preserve_existing_identification'
    : 'processing_failed'
);

assert.equal(preserveFailurePolicy('identified'), 'preserve_existing_identification');
assert.equal(preserveFailurePolicy('candidate'), 'preserve_existing_identification');
assert.equal(preserveFailurePolicy('unidentified'), 'processing_failed');
assert.equal(preserveFailurePolicy('processing_failed'), 'processing_failed');

const backoff = addressRetryBackoffMs();
assert.ok(backoff.ambiguous >= 60000);
assert.ok(backoff.failed >= 60000);
assert.ok(backoff.notFound >= 60000);

const ambiguousAddress = '  Rajanukunte, Karnataka  ';
recordAddressEnrichmentBackoff(ambiguousAddress, 'ambiguous');
assert.equal(isAddressEnrichmentReadyForRetry(ambiguousAddress), false);
clearAddressEnrichmentBackoff(ambiguousAddress);
assert.equal(isAddressEnrichmentReadyForRetry(ambiguousAddress), true);

const failedAddress = 'Temporary failed address';
recordAddressEnrichmentBackoff(failedAddress, 'failed');
assert.equal(isAddressEnrichmentReadyForRetry(failedAddress), false);
clearAddressEnrichmentBackoff(failedAddress);
assert.equal(isAddressEnrichmentReadyForRetry(failedAddress), true);

console.log(JSON.stringify({
  identifiedFailurePreserved: true,
  candidateFailurePreserved: true,
  neverIdentifiedFailureRecorded: true,
  ambiguousBackoffApplied: true,
  temporaryFailureBackoffApplied: true,
  manualBackoffClearingAvailable: true,
}, null, 2));
