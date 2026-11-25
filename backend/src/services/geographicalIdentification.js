import { query, withTransaction } from '../config/db.js';
import { createGeocodingProvider } from './geocodingProvider.js';

const CACHE_DAYS = Math.max(1, Number(process.env.GEOCODING_CACHE_DAYS || 30));
const ADDRESS_SEARCH_CACHE_TTL_MS = Math.max(
  60000,
  Number(process.env.ADDRESS_SEARCH_CACHE_TTL_MS || 30 * 60 * 1000)
);
const ADDRESS_SEARCH_CACHE_LIMIT = 500;
const addressSearchCache = new Map();
const geocodingProvider = createGeocodingProvider();
const addressRetryCache = new Map();

export const addressRetryBackoffMs = () => ({
  ambiguous: Math.max(60000, Number(process.env.AMBIGUOUS_ADDRESS_RETRY_MS || 24 * 60 * 60 * 1000)),
  failed: Math.max(60000, Number(process.env.TEMPORARY_ADDRESS_RETRY_MS || 10 * 60 * 1000)),
  notFound: Math.max(60000, Number(process.env.NOT_FOUND_ADDRESS_RETRY_MS || 24 * 60 * 60 * 1000)),
});

export const clearAddressEnrichmentBackoff = (address) => {
  addressRetryCache.delete(normalizeAddressForCache(address));
};

export const recordAddressEnrichmentBackoff = (address, kind) => {
  const normalized = normalizeAddressForCache(address);
  const backoff = addressRetryBackoffMs();
  addressRetryCache.set(normalized, {
    kind,
    retryAt: Date.now() + (backoff[kind] || backoff.failed),
  });
};

export const isAddressEnrichmentReadyForRetry = (address) => {
  const normalized = normalizeAddressForCache(address);
  const retry = addressRetryCache.get(normalized);
  if (!retry) return true;
  if (retry.retryAt <= Date.now()) {
    addressRetryCache.delete(normalized);
    return true;
  }
  return false;
};

export const normalizeAddressForCache = (address) => (
  typeof address === 'string'
    ? address.toLowerCase().replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim()
    : ''
);

export const coordinateKey = (latitude, longitude) => ({
  latitude: Number(Number(latitude).toFixed(5)),
  longitude: Number(Number(longitude).toFixed(5)),
});

export const normalizeNominatimResult = (payload) => {
  const address = payload?.address || {};
  const first = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const state = first(address.state);
  const district = first(address.state_district || address.county);
  const city = first(address.city || address.town || address.municipality);
  const taluk = first(address.taluk || address.county);
  const village = first(address.village || address.hamlet);
  const gramPanchayat = first(address.gram_panchayat || address.panchayat);
  const ward = first(address.ward || address.city_district);
  const locality = first(address.suburb || address.neighbourhood || address.quarter);
  const neighbourhood = first(address.neighbourhood);
  const postalCode = first(address.postcode);
  const regionName = village || gramPanchayat || locality || ward || city || district || state;
  const regionLevel = village
    ? 'village'
    : gramPanchayat
      ? 'gram_panchayat'
      : locality
        ? 'locality'
        : ward
          ? 'ward'
          : city
            ? 'city'
            : district
              ? 'district'
              : state
                ? 'state'
                : null;

  return {
    stateName: state,
    districtName: district,
    cityName: city,
    talukName: taluk,
    villageName: village,
    gramPanchayatName: gramPanchayat,
    wardName: ward,
    localityName: locality,
    neighbourhoodName: neighbourhood,
    postalCode,
    regionName,
    regionLevel,
    identificationStatus: regionName ? 'candidate' : 'unidentified',
    source: 'nominatim',
    confidence: payload?.importance ? Math.min(1, Number(payload.importance)) : null,
    providerReference: payload?.osm_type && payload?.osm_id
      ? `${payload.osm_type}/${payload.osm_id}`
      : null,
    rawResponse: payload,
  };
};

export const searchAddressCoordinates = async (address) => {
  const normalizedAddress = normalizeAddressForCache(address);
  if (normalizedAddress.length < 3) {
    return { status: 'invalid', results: [] };
  }

  if (addressSearchCache.has(normalizedAddress)) {
    const cached = addressSearchCache.get(normalizedAddress);
    if (cached.expiresAt > Date.now()) return cached.outcome;
    addressSearchCache.delete(normalizedAddress);
  }

  const payload = await geocodingProvider.search(address.trim());
  if (!Array.isArray(payload)) {
    throw new Error('Nominatim returned an invalid address-search response.');
  }

  const results = payload
    .map((item, index) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
        || latitude < -90 || latitude > 90
        || longitude < -180 || longitude > 180) {
        return null;
      }
      return {
        id: `${item.place_id || item.osm_id || index}-${latitude}-${longitude}`,
        displayName: typeof item.display_name === 'string' ? item.display_name : address.trim(),
        latitude,
        longitude,
        importance: Number.isFinite(Number(item.importance)) ? Number(item.importance) : null,
        osmType: item.osm_type || null,
        osmId: item.osm_id || null,
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  const outcome = {
    status: results.length > 0 ? 'ok' : 'not_found',
    results,
  };
  addressSearchCache.set(normalizedAddress, {
    expiresAt: Date.now() + ADDRESS_SEARCH_CACHE_TTL_MS,
    outcome,
  });
  if (addressSearchCache.size > ADDRESS_SEARCH_CACHE_LIMIT) {
    addressSearchCache.delete(addressSearchCache.keys().next().value);
  }
  return outcome;
};

export const reverseGeocode = async (latitude, longitude) => {
  const key = coordinateKey(latitude, longitude);
  if (!Number.isFinite(key.latitude) || !Number.isFinite(key.longitude)) {
    throw new Error('Invalid coordinates.');
  }

  const cached = await query(
    `SELECT state_name, district_name, city_name, taluk_name, village_name,
            gram_panchayat_name, ward_name, locality_name, neighbourhood_name,
            postal_code, region_name, region_level, identification_status,
            source, confidence, raw_response
     FROM geocoding_cache
     WHERE latitude_key = ? AND longitude_key = ?
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [key.latitude, key.longitude]
  );
  if (cached.rows.length > 0) {
    const row = cached.rows[0];
    return {
      stateName: row.state_name,
      districtName: row.district_name,
      cityName: row.city_name,
      talukName: row.taluk_name,
      villageName: row.village_name,
      gramPanchayatName: row.gram_panchayat_name,
      wardName: row.ward_name,
      localityName: row.locality_name,
      neighbourhoodName: row.neighbourhood_name,
      postalCode: row.postal_code,
      regionName: row.region_name,
      regionLevel: row.region_level,
      identificationStatus: row.identification_status,
      source: row.source,
      confidence: row.confidence,
      rawResponse: row.raw_response,
      providerReference: null,
    };
  }

  const payload = await geocodingProvider.reverse(key.latitude, key.longitude);
  if (payload.error) throw new Error('Nominatim could not identify these coordinates.');
  const normalized = normalizeNominatimResult(payload);
  await withTransaction(async (transactionQuery) => {
    await transactionQuery(
      `INSERT INTO geocoding_cache (
        latitude_key, longitude_key, state_name, district_name, city_name, taluk_name,
        village_name, gram_panchayat_name, ward_name, locality_name, neighbourhood_name,
        postal_code, region_name, region_level, identification_status, source,
        confidence, raw_response, fetched_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))
      ON DUPLICATE KEY UPDATE
        state_name=VALUES(state_name), district_name=VALUES(district_name),
        city_name=VALUES(city_name), taluk_name=VALUES(taluk_name),
        village_name=VALUES(village_name), gram_panchayat_name=VALUES(gram_panchayat_name),
        ward_name=VALUES(ward_name), locality_name=VALUES(locality_name),
        neighbourhood_name=VALUES(neighbourhood_name), postal_code=VALUES(postal_code),
        region_name=VALUES(region_name), region_level=VALUES(region_level),
        identification_status=VALUES(identification_status), source=VALUES(source),
        confidence=VALUES(confidence), raw_response=VALUES(raw_response),
        fetched_at=CURRENT_TIMESTAMP, expires_at=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY)`,
      [
        key.latitude, key.longitude,
        normalized.stateName, normalized.districtName, normalized.cityName, normalized.talukName,
        normalized.villageName, normalized.gramPanchayatName, normalized.wardName,
        normalized.localityName, normalized.neighbourhoodName, normalized.postalCode,
        normalized.regionName, normalized.regionLevel, normalized.identificationStatus,
        normalized.source, normalized.confidence, JSON.stringify(normalized.rawResponse),
        CACHE_DAYS, CACHE_DAYS,
      ]
    );
  });
  return normalized;
};

export const enrichComplaintLocation = async (complaintId) => {
  const complaintResult = await query(
    'SELECT id, latitude, longitude FROM complaints WHERE id = ?',
    [complaintId]
  );
  if (complaintResult.rows.length === 0) return null;
  const complaint = complaintResult.rows[0];
  if (complaint.latitude === null || complaint.longitude === null) {
    const existing = await query(
      'SELECT identification_status FROM complaint_geography WHERE complaint_id = ?',
      [complaintId]
    );
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO complaint_geography (
          complaint_id, identification_status, source, identified_at
        ) VALUES (?, 'unidentified', 'nominatim', CURRENT_TIMESTAMP)`,
        [complaintId]
      );
    } else if (!['identified', 'candidate'].includes(existing.rows[0].identification_status)) {
      await query(
        `UPDATE complaint_geography
         SET identification_status = 'unidentified', identified_at = CURRENT_TIMESTAMP
         WHERE complaint_id = ?`,
        [complaintId]
      );
    }
    return null;
  }

  try {
    const key = coordinateKey(complaint.latitude, complaint.longitude);
    const normalized = await reverseGeocode(key.latitude, key.longitude);
    await query(
      `INSERT INTO complaint_geography (
        complaint_id, latitude_key, longitude_key, state_name, district_name, city_name,
        taluk_name, village_name, gram_panchayat_name, ward_name, locality_name,
        neighbourhood_name, postal_code, region_name, region_level,
        identification_status, source, confidence, provider_reference, identified_at, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON DUPLICATE KEY UPDATE
        latitude_key=VALUES(latitude_key), longitude_key=VALUES(longitude_key),
        state_name=VALUES(state_name), district_name=VALUES(district_name),
        city_name=VALUES(city_name), taluk_name=VALUES(taluk_name),
        village_name=VALUES(village_name), gram_panchayat_name=VALUES(gram_panchayat_name),
        ward_name=VALUES(ward_name), locality_name=VALUES(locality_name),
        neighbourhood_name=VALUES(neighbourhood_name), postal_code=VALUES(postal_code),
        region_name=VALUES(region_name), region_level=VALUES(region_level),
        identification_status=VALUES(identification_status), source=VALUES(source),
        confidence=VALUES(confidence), provider_reference=VALUES(provider_reference),
        identified_at=CURRENT_TIMESTAMP, raw_response=VALUES(raw_response)`,
      [
        complaintId, key.latitude, key.longitude,
        normalized.stateName, normalized.districtName, normalized.cityName,
        normalized.talukName, normalized.villageName, normalized.gramPanchayatName,
        normalized.wardName, normalized.localityName, normalized.neighbourhoodName,
        normalized.postalCode, normalized.regionName, normalized.regionLevel,
        normalized.identificationStatus, normalized.source, normalized.confidence,
        normalized.providerReference, JSON.stringify(normalized.rawResponse),
      ]
    );
    return normalized;
  } catch (error) {
    const existing = await query(
      `SELECT identification_status
       FROM complaint_geography
       WHERE complaint_id = ?`,
      [complaintId]
    );
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO complaint_geography (
          complaint_id, latitude_key, longitude_key, identification_status, source, identified_at
        ) VALUES (?, ?, ?, 'processing_failed', 'nominatim', CURRENT_TIMESTAMP)`,
        [complaintId,
          complaint.latitude ? coordinateKey(complaint.latitude, complaint.longitude).latitude : null,
          complaint.longitude ? coordinateKey(complaint.latitude, complaint.longitude).longitude : null]
      );
    } else if (!['identified', 'candidate'].includes(existing.rows[0].identification_status)) {
      await query(
        `UPDATE complaint_geography
         SET identification_status = 'processing_failed', identified_at = CURRENT_TIMESTAMP
         WHERE complaint_id = ?`,
        [complaintId]
      );
    }
    console.error(
      `Geographical reverse identification failed for complaint ${complaintId}; ${existing.rows.length > 0 && ['identified', 'candidate'].includes(existing.rows[0].identification_status) ? 'preserving existing identification' : 'recording processing failure'}`
    );
    return null;
  }
};
