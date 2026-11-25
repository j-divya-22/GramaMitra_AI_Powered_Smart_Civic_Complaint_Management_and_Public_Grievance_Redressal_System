import assert from 'node:assert/strict';
import {
  ProcessWideGeocodingQueue,
  getGeocodingProviderConfig,
} from '../src/services/geocodingProvider.js';

const originalInterval = process.env.GEOCODING_REQUEST_INTERVAL_MS;
process.env.GEOCODING_REQUEST_INTERVAL_MS = '1000';
process.env.GEOCODING_PROVIDER = 'nominatim';
process.env.NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
process.env.NOMINATIM_COUNTRY_CODES = 'in';
process.env.GEOCODING_TIMEOUT_MS = '10000';

const config = getGeocodingProviderConfig();
assert.equal(config.name, 'nominatim');
assert.equal(config.countryCodes, 'in');
assert.equal(config.timeoutMs, 10000);

const queue = new ProcessWideGeocodingQueue({ intervalMs: 1000 });
const timestamps = [];
await Promise.all([0, 1, 2].map(async () => {
  await queue.wait();
  timestamps.push(Date.now());
}));
timestamps.sort((a, b) => a - b);
for (let index = 1; index < timestamps.length; index += 1) {
  assert.ok(timestamps[index] - timestamps[index - 1] >= 950,
    `Concurrent queue requests occurred too close together: ${timestamps[index] - timestamps[index - 1]}ms`);
}

if (originalInterval === undefined) {
  delete process.env.GEOCODING_REQUEST_INTERVAL_MS;
} else {
  process.env.GEOCODING_REQUEST_INTERVAL_MS = originalInterval;
}

console.log(JSON.stringify({
  providerConfigRead: true,
  concurrentQueueSerialized: true,
  minimumObservedSpacingMs: timestamps.length > 1
    ? Math.min(...timestamps.slice(1).map((value, index) => value - timestamps[index]))
    : null,
}, null, 2));
