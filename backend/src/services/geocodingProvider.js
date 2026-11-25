import fetch from 'node-fetch';

export class ProcessWideGeocodingQueue {
  constructor({ intervalMs = 1100 } = {}) {
    this.intervalMs = Math.max(1000, Number(intervalMs) || 1100);
    this.lastRequestAt = 0;
    this.queue = Promise.resolve();
  }

  async wait() {
    const run = this.queue.then(async () => {
      const elapsed = Date.now() - this.lastRequestAt;
      const remaining = this.intervalMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      this.lastRequestAt = Date.now();
    });
    this.queue = run.catch(() => {});
    await run;
  }
}

const envText = (value, fallback) => (
  typeof value === 'string' && value.trim() ? value.trim() : fallback
);

export const getGeocodingProviderConfig = () => {
  const provider = envText(process.env.GEOCODING_PROVIDER, 'nominatim').toLowerCase();
  if (provider !== 'nominatim') {
    throw new Error(`Unsupported geocoding provider: ${provider}`);
  }
  return {
    name: 'nominatim',
    baseUrl: envText(process.env.NOMINATIM_URL, 'https://nominatim.openstreetmap.org').replace(/\/+$/, ''),
    contact: envText(process.env.NOMINATIM_CONTACT, ''),
    countryCodes: envText(process.env.NOMINATIM_COUNTRY_CODES, 'in'),
    timeoutMs: Math.max(1000, Number(process.env.GEOCODING_TIMEOUT_MS || 10000)),
    userAgent: envText(process.env.NOMINATIM_USER_AGENT, 'GramaMitra-Regional-Insights/1.0'),
  };
};

export const createGeocodingProvider = () => {
  const config = getGeocodingProviderConfig();
  const queue = new ProcessWideGeocodingQueue({
    intervalMs: Number(process.env.GEOCODING_REQUEST_INTERVAL_MS || 1100),
  });

  const request = async (path, params) => {
    await queue.wait();
    const url = new URL(path, `${config.baseUrl}/`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

    const headers = {
      Accept: 'application/json',
      'User-Agent': config.userAgent,
    };
    if (config.contact) headers['Referer'] = config.contact;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Nominatim geocoding failed with HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Nominatim geocoding timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    name: config.name,
    async search(address) {
      return request('/search', {
        q: address,
        format: 'jsonv2',
        addressdetails: 1,
        'accept-language': 'en',
        limit: 5,
        countrycodes: config.countryCodes,
      });
    },
    async reverse(latitude, longitude) {
      return request('/reverse', {
        format: 'jsonv2',
        lat: latitude,
        lon: longitude,
        zoom: 18,
        addressdetails: 1,
        'accept-language': 'en',
      });
    },
  };
};
