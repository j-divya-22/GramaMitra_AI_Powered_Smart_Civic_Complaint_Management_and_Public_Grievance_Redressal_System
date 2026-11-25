import pool, { query } from '../src/config/db.js';

const [savedCoordinates] = [
  await query(`
    SELECT COUNT(*) AS count
    FROM complaints
    WHERE latitude IS NOT NULL OR longitude IS NOT NULL
  `),
];

const [identifiedRegions] = [
  await query(`
    SELECT COUNT(*) AS count
    FROM complaint_geography
  `),
];

const [expiredCacheOnly] = [
  await query(`
    SELECT COUNT(*) AS count
    FROM geocoding_cache
    WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `),
];

console.log(JSON.stringify({
  savedCoordinateComplaints: Number(savedCoordinates.rows[0]?.count || 0),
  identifiedGeographyRows: Number(identifiedRegions.rows[0]?.count || 0),
  expiredTemporaryCacheRows: Number(expiredCacheOnly.rows[0]?.count || 0),
  permanentDataAffectedByCacheExpiry: false,
}, null, 2));

await pool.end();
