import { query, withTransaction } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../services/auditLog.js';
import {
  enrichComplaintLocation,
  searchAddressCoordinates,
  isAddressEnrichmentReadyForRetry,
  recordAddressEnrichmentBackoff,
  clearAddressEnrichmentBackoff,
} from '../services/geographicalIdentification.js';

const DEPARTMENT_SELECT = `
  SELECT id, department_name AS name, description,
         NULL AS contact_email, NULL AS contact_phone, NULL AS office_location,
         JSON_OBJECT() AS working_hours, description AS procedures,
         is_active, created_at
  FROM departments
`;

const assertDepartmentFieldsSupported = (body) => {
  const unsupportedFields = ['contact_email', 'contact_phone', 'office_location', 'working_hours']
    .filter((field) => body[field] !== undefined && body[field] !== null && body[field] !== '');
  if (unsupportedFields.length > 0) {
    const error = new Error(
      `The MySQL departments table cannot store: ${unsupportedFields.join(', ')}.`
    );
    error.statusCode = 400;
    throw error;
  }
};

const departmentDescription = (body) => {
  const value = body.description ?? body.procedures ?? null;
  if (value !== null && typeof value !== 'string') {
    const error = new Error('Department description must be text.');
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const buildDashboardFilter = (queryParams) => {
  const conditions = [];
  const params = [];
  const citizen = typeof queryParams.citizen === 'string' ? queryParams.citizen.trim() : '';
  const fromDate = queryParams.from_date;
  const toDate = queryParams.to_date;
  const categories = (queryParams.category || '').split(',').map((value) => value.trim()).filter(Boolean);
  const statuses = (queryParams.status || '').split(',').map((value) => value.trim()).filter(Boolean);
  const progressMin = queryParams.progress_min;
  const progressMax = queryParams.progress_max;

  if (citizen) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${citizen}%`, `%${citizen}%`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate || '')) {
    conditions.push('c.created_at >= ?');
    params.push(`${fromDate} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDate || '')) {
    conditions.push('c.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  if (categories.length) {
    conditions.push(`c.category IN (${categories.map(() => '?').join(', ')})`);
    params.push(...categories);
  }
  if (statuses.length) {
    conditions.push(`c.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (progressMin !== undefined || progressMax !== undefined) {
    const min = progressMin === undefined || progressMin === '' ? 0 : Number(progressMin);
    const max = progressMax === undefined || progressMax === '' ? 100 : Number(progressMax);
    if (Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= 100 && min <= max) {
      conditions.push(`EXISTS (
        SELECT 1 FROM complaint_progress_updates fp
        WHERE fp.complaint_id = c.id
          AND fp.progress_percentage BETWEEN ? AND ?
          AND fp.id = (
            SELECT lp.id FROM complaint_progress_updates lp
            WHERE lp.complaint_id = c.id
            ORDER BY lp.created_at DESC, lp.id DESC LIMIT 1
          )
      )`);
      params.push(min, max);
    }
  }

  return {
    whereClause: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

const getStats = async (queryParams) => {
  const { whereClause, params } = buildDashboardFilter(queryParams);
  const result = await query(
    `SELECT COUNT(*) AS total,
            SUM(c.status IN ('pending', 'Submitted', 'submitted')) AS pending,
            SUM(c.status = 'assigned') AS assigned,
            SUM(c.status = 'in_progress') AS in_progress,
            SUM(c.status = 'resolved') AS resolved,
            SUM(c.status = 'rejected') AS rejected
     FROM complaints c
     LEFT JOIN users u ON u.id = c.citizen_id${whereClause}`,
    params
  );
  const row = result.rows[0];
  return {
    total: Number(row.total),
    pending: Number(row.pending || 0),
    assigned: Number(row.assigned || 0),
    in_progress: Number(row.in_progress || 0),
    resolved: Number(row.resolved || 0),
    rejected: Number(row.rejected || 0),
  };
};

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { whereClause, params } = buildDashboardFilter(req.query);
  const [stats, byCategory, recent] = await Promise.all([
    getStats(req.query),
    query(
      `SELECT c.category, COUNT(*) AS count
       FROM complaints c
       LEFT JOIN users u ON u.id = c.citizen_id${whereClause}
       GROUP BY c.category
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT c.id, c.complaint_number AS reference_number, c.category,
              c.address AS location_address, c.status, c.created_at,
              u.full_name AS citizen_name
       FROM complaints c
       LEFT JOIN users u ON u.id = c.citizen_id${whereClause}
       ORDER BY c.created_at DESC
       LIMIT 10`,
      params
    ),
  ]);

  res.json({
    ...stats,
    byCategory: byCategory.rows,
    recentComplaints: recent.rows,
  });
});

const validateDate = (value) => (
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
);

const buildRegionalWhere = (queryParams) => {
  const conditions = [];
  const params = [];
  const regionLevel = typeof queryParams.region_level === 'string'
    ? queryParams.region_level.trim()
    : '';
  const regionName = typeof queryParams.region === 'string'
    ? queryParams.region.trim()
    : '';
  const district = typeof queryParams.district === 'string'
    ? queryParams.district.trim()
    : '';
  const city = typeof queryParams.city === 'string'
    ? queryParams.city.trim()
    : '';
  const taluk = typeof queryParams.taluk === 'string'
    ? queryParams.taluk.trim()
    : '';
  const village = typeof queryParams.village === 'string'
    ? queryParams.village.trim()
    : '';
  const ward = typeof queryParams.ward === 'string'
    ? queryParams.ward.trim()
    : '';
  const locality = typeof queryParams.locality === 'string'
    ? queryParams.locality.trim()
    : '';

  if (regionLevel && regionName) {
    const allowedLevels = ['state', 'district', 'city', 'taluk', 'village', 'gram_panchayat', 'ward', 'locality', 'neighbourhood'];
    if (!allowedLevels.includes(regionLevel)) {
      const error = new Error('Invalid regional level.');
      error.statusCode = 400;
      throw error;
    }
    const levelColumn = {
      state: 'cg.state_name',
      district: 'cg.district_name',
      city: 'cg.city_name',
      taluk: 'cg.taluk_name',
      village: 'cg.village_name',
      gram_panchayat: 'cg.gram_panchayat_name',
      ward: 'cg.ward_name',
      locality: 'cg.locality_name',
      neighbourhood: 'cg.neighbourhood_name',
    }[regionLevel];
    if (regionName === 'Unknown / Unidentified') {
      conditions.push(`(
        ${levelColumn} IS NULL
        OR ${levelColumn} = ''
        OR cg.identification_status NOT IN ('identified', 'candidate')
      )`);
    } else {
      conditions.push(`${levelColumn} = ?`);
      params.push(regionName);
    }
  }
  [
    ['district', district, 'cg.district_name'],
    ['city', city, 'cg.city_name'],
    ['taluk', taluk, 'cg.taluk_name'],
    ['village', village, 'cg.village_name'],
    ['ward', ward, 'cg.ward_name'],
    ['locality', locality, 'cg.locality_name'],
  ].forEach(([, value, column]) => {
    if (value) {
      conditions.push(`${column} = ?`);
      params.push(value);
    }
  });

  const categories = (queryParams.category || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (categories.length) {
    const namedCategories = categories.filter((value) => value !== 'Unknown');
    const unknownSelected = categories.includes('Unknown');
    const categoryConditions = [];
    if (namedCategories.length) {
      categoryConditions.push(`c.category IN (${namedCategories.map(() => '?').join(', ')})`);
      params.push(...namedCategories);
    }
    if (unknownSelected) {
      categoryConditions.push(`(c.category IS NULL OR c.category = '' OR LOWER(c.category) IN ('unknown', 'uncategorized'))`);
    }
    if (categoryConditions.length) {
      conditions.push(`(${categoryConditions.join(' OR ')})`);
    }
  }
  const statuses = (queryParams.status || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (statuses.length) {
    const allowedStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
    if (statuses.some((value) => !allowedStatuses.includes(value))) {
      const error = new Error('Invalid complaint status filter.');
      error.statusCode = 400;
      throw error;
    }
    conditions.push(`c.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }

  const fromDate = queryParams.from_date;
  const toDate = queryParams.to_date;
  if (fromDate) {
    if (!validateDate(fromDate)) {
      const error = new Error('From date must use YYYY-MM-DD format.');
      error.statusCode = 400;
      throw error;
    }
    conditions.push('c.created_at >= ?');
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    if (!validateDate(toDate)) {
      const error = new Error('To date must use YYYY-MM-DD format.');
      error.statusCode = 400;
      throw error;
    }
    conditions.push('c.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  return {
    whereClause: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

export const getRegionalOptions = asyncHandler(async (req, res) => {
  const level = typeof req.query.level === 'string' ? req.query.level.trim() : '';
  const allowedColumns = {
    district: 'district_name',
    city: 'city_name',
    taluk: 'taluk_name',
    village: 'village_name',
    gram_panchayat: 'gram_panchayat_name',
    gram_panchayat: 'gram_panchayat_name',
    ward: 'ward_name',
    locality: 'locality_name',
  };
  if (!allowedColumns[level]) {
    return res.status(400).json({ error: 'Choose a valid regional level.' });
  }
  const column = allowedColumns[level];
  const result = await query(
    `SELECT ${column} AS name, COUNT(*) AS count
     FROM complaint_geography
     WHERE identification_status IN ('identified', 'candidate')
       AND ${column} IS NOT NULL AND ${column} <> ''
     GROUP BY ${column}
     ORDER BY count DESC, name ASC
     LIMIT 200`
  );
   const [unknownResult] = await Promise.all([
     query(
       `SELECT COUNT(*) AS count
        FROM complaints c
        LEFT JOIN complaint_geography cg ON cg.complaint_id = c.id
        WHERE cg.identification_status NOT IN ('identified', 'candidate')
           OR cg.complaint_id IS NULL
           OR cg.${column} IS NULL
           OR cg.${column} = ''`
     ),
   ]);
   const options = result.rows;
   const unknownCount = Number(unknownResult.rows[0]?.count || 0);
   if (unknownCount > 0) {
     options.push({ name: 'Unknown / Unidentified', count: unknownCount });
   }
   res.json({ level, options });
});

export const getRegionalInsights = asyncHandler(async (req, res) => {
  const { whereClause, params } = buildRegionalWhere(req.query);
  const joins = 'FROM complaints c LEFT JOIN complaint_geography cg ON cg.complaint_id = c.id';
  const baseWhere = whereClause || '';

  const [summaryResult, categoryResult, statusResult, regionResult, monthlySubmittedResult, monthlyResolvedResult, complaintsResult] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total,
              SUM(c.status = 'resolved') AS resolved,
              SUM(c.status = 'pending' OR c.status = 'Submitted' OR c.status = 'submitted') AS pending,
              SUM(c.status = 'assigned' OR c.status = 'in_progress') AS in_progress,
              SUM(c.status = 'rejected') AS rejected
       ${joins}${baseWhere}`,
      params
    ),
    query(
      `SELECT CASE
                WHEN c.category IS NULL OR c.category = ''
                  OR LOWER(c.category) IN ('unknown', 'uncategorized')
                THEN 'Unknown'
                ELSE c.category
              END AS category,
              COUNT(DISTINCT c.id) AS count
       ${joins}${baseWhere}
       GROUP BY category
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT c.status, COUNT(DISTINCT c.id) AS count
       ${joins}${baseWhere}
       GROUP BY c.status
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT CASE
                WHEN cg.identification_status IN ('identified', 'candidate')
                  AND COALESCE(cg.region_name, cg.locality_name, cg.village_name, cg.city_name, cg.district_name) IS NOT NULL
                THEN COALESCE(cg.region_name, cg.locality_name, cg.village_name, cg.city_name, cg.district_name)
                ELSE 'Unknown / Unidentified'
              END AS region,
              COUNT(DISTINCT c.id) AS total,
              SUM(c.status = 'resolved') AS resolved,
              SUM(c.status = 'pending' OR c.status = 'Submitted' OR c.status = 'submitted') AS pending,
              SUM(c.status = 'assigned' OR c.status = 'in_progress') AS in_progress
       ${joins}${baseWhere}
       GROUP BY region
       HAVING region IS NOT NULL AND region <> ''
       ORDER BY total DESC
       LIMIT 100`,
      params
    ),
    query(
      `SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS month,
              COUNT(DISTINCT c.id) AS submitted
       ${joins}${baseWhere}
       GROUP BY month
       ORDER BY month ASC`,
      params
    ),
    query(
      `SELECT DATE_FORMAT(c.resolved_at, '%Y-%m') AS month,
              COUNT(DISTINCT c.id) AS resolved
       ${joins}${baseWhere}
         ${baseWhere ? 'AND c.resolved_at IS NOT NULL' : 'WHERE c.resolved_at IS NOT NULL'}
       GROUP BY month
       ORDER BY month ASC`,
      params
    ),
    query(
      `SELECT c.id, c.complaint_number AS reference_number, c.category,
              c.english_text AS description,
              c.status, c.created_at, c.resolved_at,
              c.address AS location_address, c.latitude, c.longitude,
              cg.region_name, cg.region_level, cg.identification_status,
              cg.district_name, cg.city_name, cg.taluk_name, cg.village_name,
              cg.gram_panchayat_name, cg.ward_name, cg.locality_name
       ${joins}${baseWhere}
       ORDER BY c.created_at DESC
       LIMIT 200`,
      params
    ),
  ]);

  const summaryRow = summaryResult.rows[0];
  const total = Number(summaryRow.total || 0);
  const resolved = Number(summaryRow.resolved || 0);
  const pending = Number(summaryRow.pending || 0);
  const inProgress = Number(summaryRow.in_progress || 0);
  const monthlyMap = new Map();
  monthlySubmittedResult.rows.forEach((row) => {
    monthlyMap.set(row.month, {
      month: row.month,
      submitted: Number(row.submitted || 0),
      resolved: 0,
    });
  });
  monthlyResolvedResult.rows.forEach((row) => {
    const existing = monthlyMap.get(row.month) || {
      month: row.month,
      submitted: 0,
      resolved: 0,
    };
    existing.resolved = Number(row.resolved || 0);
    monthlyMap.set(row.month, existing);
  });
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  res.json({
    summary: {
      total,
      resolved,
      pending,
      in_progress: inProgress,
      rejected: Number(summaryRow.rejected || 0),
      resolution_percentage: total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 0,
    },
    categories: categoryResult.rows,
    statuses: statusResult.rows,
    regions: regionResult.rows,
    monthly,
    complaints: complaintsResult.rows,
  });
});

export const enrichRegionalLocations = asyncHandler(async (req, res) => {
  const configuredLimit = Math.max(1, Number.parseInt(process.env.REGIONAL_ENRICHMENT_BATCH_SIZE, 10) || 10);
  const requestedLimit = Number.parseInt(req.body?.limit, 10);
  const limit = Math.min(
    20,
    Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : configuredLimit)
  );
  const candidateResult = await query(
    `SELECT c.id, c.address, c.latitude, c.longitude
     FROM complaints c
     LEFT JOIN complaint_geography cg ON cg.complaint_id = c.id
     WHERE (
       ((c.latitude IS NULL OR c.longitude IS NULL)
         AND c.address IS NOT NULL
         AND TRIM(c.address) <> '')
       OR
       (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
         AND (cg.complaint_id IS NULL
           OR cg.identification_status IN ('processing_failed', 'unidentified')))
     )
     ORDER BY c.created_at DESC`
  );
  const readyCandidates = candidateResult.rows.filter((row) => (
    row.latitude !== null && row.longitude !== null
      ? true
      : isAddressEnrichmentReadyForRetry(row.address)
  ));
  const result = { rows: readyCandidates.slice(0, limit) };
  const totalEligible = readyCandidates.length;
  const processed = [];
  const successfullyGeocoded = [];
  const successfullyIdentified = [];
  const unsuccessful = [];
  const ambiguous = [];
  const skipped = [];
  for (const row of result.rows) {
    try {
      if (row.latitude !== null && row.longitude !== null) {
        const identified = await enrichComplaintLocation(row.id);
        processed.push(row.id);
        if (identified) successfullyIdentified.push(row.id);
        continue;
      }
      if (!isAddressEnrichmentReadyForRetry(row.address)) {
        skipped.push(row.id);
        continue;
      }
      const outcome = await searchAddressCoordinates(row.address);
      if (outcome.status !== 'ok' || outcome.results.length === 0) {
        recordAddressEnrichmentBackoff(
          row.address,
          outcome.status === 'not_found' ? 'notFound' : 'failed'
        );
        unsuccessful.push(row.id);
        continue;
      }
      if (outcome.results.length !== 1) {
        recordAddressEnrichmentBackoff(row.address, 'ambiguous');
        ambiguous.push(row.id);
        continue;
      }
      const match = outcome.results[0];
      const latitude = Number(match.latitude);
      const longitude = Number(match.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
        || latitude < -90 || latitude > 90
        || longitude < -180 || longitude > 180) {
        recordAddressEnrichmentBackoff(row.address, 'failed');
        unsuccessful.push(row.id);
        continue;
      }
      await withTransaction(async (transactionQuery) => {
        await transactionQuery(
          `UPDATE complaints
           SET latitude = CASE WHEN latitude IS NULL THEN ? ELSE latitude END,
               longitude = CASE WHEN longitude IS NULL THEN ? ELSE longitude END
           WHERE id = ?`,
          [latitude, longitude, row.id]
        );
      });
      clearAddressEnrichmentBackoff(row.address);
      successfullyGeocoded.push(row.id);
      const identified = await enrichComplaintLocation(row.id);
      if (identified) successfullyIdentified.push(row.id);
      processed.push(row.id);
    } catch (error) {
      unsuccessful.push(row.id);
    }
  }
  const remainingCandidateResult = await query(
    `SELECT c.id, c.address, c.latitude, c.longitude
     FROM complaints c
     LEFT JOIN complaint_geography cg ON cg.complaint_id = c.id
     WHERE (
       ((c.latitude IS NULL OR c.longitude IS NULL)
         AND c.address IS NOT NULL
         AND TRIM(c.address) <> '')
       OR
       (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
         AND (cg.complaint_id IS NULL
           OR cg.identification_status IN ('processing_failed', 'unidentified')))
     )
     ORDER BY c.created_at DESC`
  );
  const remainingEligible = remainingCandidateResult.rows.filter((row) => (
    row.latitude !== null && row.longitude !== null
      ? true
      : isAddressEnrichmentReadyForRetry(row.address)
  )).length;
  res.json({
    requested: limit,
    total_eligible: totalEligible,
    remaining_eligible: remainingEligible,
    has_another_batch: remainingEligible > 0,
    eligible: result.rows.length,
    success: processed.length,
    processed_count: processed.length,
    successfully_geocoded: successfullyGeocoded.length,
    successfully_geocoded_ids: successfullyGeocoded,
    successfully_identified: successfullyIdentified.length,
    successfully_identified_ids: successfullyIdentified,
    unsuccessful: unsuccessful.length,
    ambiguous: ambiguous.length,
    skipped: skipped.length,
    processed,
    unsuccessful_ids: unsuccessful,
    ambiguous_ids: ambiguous,
    skipped_ids: skipped,
  });
});

export const getDepartments = asyncHandler(async (req, res) => {
  const result = await query(`${DEPARTMENT_SELECT} ORDER BY department_name`);
  res.json({ departments: result.rows });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, department_name: departmentName } = req.body;
  const normalizedName = typeof name === 'string'
    ? name.trim()
    : typeof departmentName === 'string' ? departmentName.trim() : '';
  if (!normalizedName || normalizedName.length > 150) {
    return res.status(400).json({ error: 'A department name of at most 150 characters is required' });
  }
  assertDepartmentFieldsSupported(req.body);

  try {
    const department = await withTransaction(async (transactionQuery) => {
      const result = await transactionQuery(
        'INSERT INTO departments (department_name, description) VALUES (?, ?)',
        [normalizedName, departmentDescription(req.body)]
      );
      await logAuditEvent(transactionQuery, {
        userId: req.user.id,
        action: 'department.created',
        entityType: 'department',
        entityId: result.insertId,
        details: { department_name: normalizedName },
      });
      const departmentResult = await transactionQuery(
        `${DEPARTMENT_SELECT} WHERE id = ?`,
        [result.insertId]
      );
      return departmentResult.rows[0];
    });
    res.status(201).json({ department });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Department already exists' });
    }
    throw error;
  }
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const { name, department_name: departmentName } = req.body;
  const normalizedName = typeof name === 'string'
    ? name.trim()
    : typeof departmentName === 'string' ? departmentName.trim() : '';
  if (!normalizedName || normalizedName.length > 150) {
    return res.status(400).json({ error: 'A department name of at most 150 characters is required' });
  }
  assertDepartmentFieldsSupported(req.body);

  try {
    const department = await withTransaction(async (transactionQuery) => {
      const current = await transactionQuery('SELECT id FROM departments WHERE id = ?', [req.params.id]);
      if (current.rows.length === 0) return null;

      await transactionQuery(
        'UPDATE departments SET department_name = ?, description = ? WHERE id = ?',
        [normalizedName, departmentDescription(req.body), req.params.id]
      );
      await logAuditEvent(transactionQuery, {
        userId: req.user.id,
        action: 'department.updated',
        entityType: 'department',
        entityId: req.params.id,
        details: { department_name: normalizedName },
      });
      const departmentResult = await transactionQuery(
        `${DEPARTMENT_SELECT} WHERE id = ?`,
        [req.params.id]
      );
      return departmentResult.rows[0];
    });

    if (!department) return res.status(404).json({ error: 'Department not found' });
    res.json({ department });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Department already exists' });
    }
    throw error;
  }
});

export const getKnowledgeDocuments = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, title, content_text AS content, file_path,
            document_type AS category, NULL AS department_id,
            uploaded_by AS created_by, created_at
     FROM knowledge_documents
     ORDER BY created_at DESC`
  );
  res.json({ documents: result.rows });
});

export const createKnowledgeDocument = asyncHandler(async (req, res) => {
  const { title, content, department_id: departmentId, category, file_path: filePath } = req.body;
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    return res.status(400).json({
      error: 'The MySQL knowledge_documents table does not support department_id.',
    });
  }
  if (typeof title !== 'string' || !title.trim() || title.length > 255) {
    return res.status(400).json({ error: 'A document title of at most 255 characters is required' });
  }
  if (content !== undefined && content !== null && typeof content !== 'string') {
    return res.status(400).json({ error: 'Document content must be text' });
  }
  if (category !== undefined && category !== null && (typeof category !== 'string' || category.length > 100)) {
    return res.status(400).json({ error: 'Document type must be at most 100 characters' });
  }
  if (filePath !== undefined && filePath !== null && (typeof filePath !== 'string' || filePath.length > 500)) {
    return res.status(400).json({ error: 'Document path must be at most 500 characters' });
  }

  const document = await withTransaction(async (transactionQuery) => {
    const result = await transactionQuery(
      `INSERT INTO knowledge_documents (title, content_text, file_path, document_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), content ?? null, filePath || null, category || null, req.user.id]
    );
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'knowledge_document.created',
      entityType: 'knowledge_document',
      entityId: result.insertId,
      details: { title: title.trim() },
    });
    const documentResult = await transactionQuery(
      `SELECT id, title, content_text AS content, file_path,
              document_type AS category, NULL AS department_id,
              uploaded_by AS created_by, created_at
       FROM knowledge_documents
       WHERE id = ?`,
      [result.insertId]
    );
    return documentResult.rows[0];
  });
  res.status(201).json({ document });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT a.id, a.user_id AS admin_id, a.action, a.entity_type, a.entity_id,
            a.details, a.created_at, u.full_name AS admin_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 100`
  );
  res.json({ logs: result.rows });
});
