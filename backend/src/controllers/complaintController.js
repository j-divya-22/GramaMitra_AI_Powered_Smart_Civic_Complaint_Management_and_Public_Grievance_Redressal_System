import { query, withTransaction } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../services/auditLog.js';
import {
  removeUploadedFile,
  resolveUploadedFilePath,
  toRelativeUploadPath,
} from '../utils/uploadPaths.js';
import { isCitizenComplaintEditable } from '../utils/complaintPermissions.js';
import {
  classifyUploadedImage,
  classificationFailureForReview,
  getImageMimeType,
  getSelectedComplaintCategory,
  isSupportedComplaintCategory,
} from '../services/cnnClassification.js';
import { v4 as uuidv4 } from 'uuid';
import {
  addComplaintSubmissionReward,
  complaintRewardForResolution,
} from '../services/rewardService.js';
import {
  enrichComplaintLocation,
  searchAddressCoordinates,
} from '../services/geographicalIdentification.js';
import { getCitizenRewardSummary } from '../services/rewardService.js';

const PROGRESS_STAGES = [
  'Complaint Received',
  'Investigation',
  'Work in Progress',
  'Verification',
  'Resolved',
];

const COMPLAINT_SELECT = `
  SELECT c.id, c.complaint_number AS reference_number, c.citizen_id,
         c.assigned_admin_id AS assigned_to, c.category,
         c.original_text AS original_complaint, c.english_text AS description,
         c.generated_title, c.generated_description AS llm_generated_text,
         NULL AS suggested_corrective_action, NULL AS ai_prediction,
         NULL AS ai_confidence, c.priority, c.status,
         c.address AS location_address, c.latitude, c.longitude,
         c.incident_date, c.resolved_at, c.created_at, c.updated_at,
         u.full_name AS citizen_name, u.email AS citizen_email,
         latest_progress.progress_percentage,
         latest_progress.stage AS latest_progress_stage
  FROM complaints c
  LEFT JOIN users u ON u.id = c.citizen_id
  LEFT JOIN complaint_progress_updates latest_progress
    ON latest_progress.id = (
      SELECT p.id
      FROM complaint_progress_updates p
      WHERE p.complaint_id = c.id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 1
    )
`;

const attachEvidenceFiles = async (complaints, runQuery = query) => {
  if (complaints.length === 0) return complaints;

  const ids = complaints.map((complaint) => complaint.id);
  const placeholders = ids.map(() => '?').join(', ');
  const imageResult = await runQuery(
    `SELECT id, complaint_id, image_path, cnn_category, cnn_confidence, vlm_description, created_at
     FROM complaint_images
     WHERE complaint_id IN (${placeholders})
     ORDER BY created_at, id`,
    ids
  );
  const filesByComplaint = new Map();

  for (const image of imageResult.rows) {
    const filename = image.image_path.split('/').pop();
    const files = filesByComplaint.get(String(image.complaint_id)) || [];
    files.push({
      id: image.id,
      filename,
      originalname: filename,
      mimetype: null,
      size: null,
      path: image.image_path,
      url: `/${image.image_path.replace(/^\/+/, '')}`,
      cnn_category: image.cnn_category,
      cnn_confidence: image.cnn_confidence,
      vlm_description: image.vlm_description,
    });
    filesByComplaint.set(String(image.complaint_id), files);
  }

  return complaints.map((complaint) => ({
    ...complaint,
    evidence_files: filesByComplaint.get(String(complaint.id)) || [],
  }));
};

const getCitizenComplaintMutationState = async (runQuery, complaintId, citizenId, lock = false) => {
  const result = await runQuery(
    `SELECT id, citizen_id, complaint_number, status, assigned_admin_id
     FROM complaints
     WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [complaintId]
  );
  if (result.rows.length === 0) {
    return { statusCode: 404, error: 'Complaint not found' };
  }

  const complaint = result.rows[0];
  if (String(complaint.citizen_id) !== String(citizenId)) {
    return { statusCode: 403, error: 'Not authorized to change this complaint' };
  }

  const activityResult = await runQuery(
    `SELECT
       EXISTS (SELECT 1 FROM complaint_status_history WHERE complaint_id = ?) AS has_status_history,
       EXISTS (SELECT 1 FROM complaint_progress_updates WHERE complaint_id = ?) AS has_progress_updates`,
    [complaintId, complaintId]
  );
  const activity = activityResult.rows[0];
  if (!isCitizenComplaintEditable({
    status: complaint.status,
    assigned_admin_id: complaint.assigned_admin_id,
    has_status_history: activity.has_status_history,
    has_progress_updates: activity.has_progress_updates,
  })) {
    return {
      statusCode: 409,
      error: 'This complaint can no longer be changed because admin processing has started.',
    };
  }

  return { complaint };
};

const removeStoredFiles = async (storedPaths, action) => {
  const warnings = [];
  for (const storedPath of storedPaths) {
    const error = await removeUploadedFile(storedPath);
    if (error) {
      console.error(`Could not remove complaint image after ${action}:`, error.message);
      warnings.push(error.message);
    }
  }
  return warnings;
};

const getStatusTimeline = async (complaint) => {
  const result = await query(
    `SELECT h.id, h.old_status, h.new_status AS status, h.reason AS message,
            u.full_name AS actorName, 'admin' AS actorRole, h.created_at AS createdAt
     FROM complaint_status_history h
     JOIN users u ON u.id = h.admin_id
     WHERE h.complaint_id = ?
     ORDER BY h.created_at, h.id`,
    [complaint.id]
  );

  if (result.rows.length > 0) return result.rows;
  return [{
    id: 'current-status',
    status: complaint.status,
    actorName: 'Gramamitra',
    actorRole: 'system',
    message: `Current status: ${complaint.status}.`,
    createdAt: complaint.updated_at || complaint.created_at,
  }];
};

const getProgressUpdates = async (complaintId) => {
  const result = await query(
    `SELECT p.id, p.complaint_id, p.admin_id, p.stage, p.progress_percentage,
            p.remarks, p.created_at, u.full_name AS admin_name
     FROM complaint_progress_updates p
     JOIN users u ON u.id = p.admin_id
     WHERE p.complaint_id = ?
     ORDER BY p.created_at, p.id`,
    [complaintId]
  );
  return result.rows;
};

const getComplaintSummary = async () => {
  const result = await query(
    `SELECT COUNT(*) AS total,
            SUM(status IN ('pending', 'Submitted', 'submitted')) AS pending,
            SUM(status = 'assigned') AS assigned,
            SUM(status = 'in_progress') AS in_progress,
            SUM(status = 'resolved') AS resolved,
            SUM(status = 'rejected') AS rejected
     FROM complaints`
  );
  const summary = result.rows[0];
  return {
    total: Number(summary.total),
    pending: Number(summary.pending || 0),
    assigned: Number(summary.assigned || 0),
    in_progress: Number(summary.in_progress || 0),
    resolved: Number(summary.resolved || 0),
    rejected: Number(summary.rejected || 0),
  };
};

export const createComplaint = asyncHandler(async (req, res) => {
  const {
    category,
    description,
    original_complaint,
    latitude,
    longitude,
    location_address,
    incident_date,
    evidence_files,
    llm_generated_text,
    location_confirmed,
  } = req.body || {};

  if (typeof description !== 'string' || !description.trim() || description.length > 5000) {
    return res.status(400).json({ error: 'A description between 1 and 5000 characters is required' });
  }
  if (typeof location_address !== 'string' || !location_address.trim() || location_address.length > 500) {
    return res.status(400).json({ error: 'A location address of at most 500 characters is required' });
  }
  if (location_confirmed !== true) {
    return res.status(400).json({ error: 'Confirm the issue location before submitting' });
  }
  if (original_complaint !== undefined && typeof original_complaint !== 'string') {
    return res.status(400).json({ error: 'The original complaint must be text' });
  }
  if (evidence_files !== undefined && (!Array.isArray(evidence_files) || evidence_files.length > 10)) {
    return res.status(400).json({ error: 'Evidence files must be provided as a list of at most 10 files' });
  }

  const evidence = [];
  try {
    for (const file of evidence_files || []) {
      if (!file || typeof file.filename !== 'string') {
        return res.status(400).json({ error: 'Each evidence file must include its uploaded filename' });
      }
      const imagePath = toRelativeUploadPath(file.filename);
      evidence.push({
        filename: file.filename,
        imagePath,
        mimetype: getImageMimeType(file),
        cnnCategory: null,
        cnnConfidence: null,
        vlmDescription: null,
      });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (category !== undefined && (
    typeof category !== 'string'
    || category.length > 100
    || (category !== '' && !isSupportedComplaintCategory(category))
  )) {
    return res.status(400).json({ error: 'Choose a supported complaint category identifier' });
  }
  const imageEvidence = evidence.filter((file) => file.mimetype);
  if (imageEvidence.length === 0 && !isSupportedComplaintCategory(category)) {
    return res.status(400).json({ error: 'Choose one of the available complaint categories when no image is provided' });
  }

  const hasLatitude = latitude !== undefined && latitude !== null;
  const hasLongitude = longitude !== undefined && longitude !== null;
  if (hasLatitude !== hasLongitude) {
    return res.status(400).json({ error: 'Latitude and longitude must be provided together' });
  }
  const parsedLatitude = hasLatitude && (typeof latitude === 'number' || (typeof latitude === 'string' && latitude.trim()))
    ? Number(latitude)
    : null;
  const parsedLongitude = hasLongitude && (typeof longitude === 'number' || (typeof longitude === 'string' && longitude.trim()))
    ? Number(longitude)
    : null;
  if (hasLatitude && (
    !Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90 ||
    !Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180
  )) {
    return res.status(400).json({ error: 'The supplied coordinates are invalid' });
  }

  let incidentDate = null;
  if (incident_date) {
    const parsedIncidentDate = new Date(incident_date);
    if (Number.isNaN(parsedIncidentDate.getTime())) {
      return res.status(400).json({ error: 'The incident date is invalid' });
    }
    incidentDate = parsedIncidentDate.toISOString().slice(0, 10);
  }

  const classifications = await Promise.all(imageEvidence.map(async (file) => {
    try {
      return await classifyUploadedImage(file);
    } catch (error) {
      const reviewResult = classificationFailureForReview(error);
      console.error(
        `CNN classification failed for ${file.filename}; marking the image for review:`,
        error.message
      );
      return reviewResult;
    }
  }));
  imageEvidence.forEach((file, index) => {
    file.cnnCategory = classifications[index].prediction;
    file.cnnConfidence = classifications[index].confidence;
  });
  const complaintCategory = getSelectedComplaintCategory(category);

  const citizenId = req.user.id;
  const complaintNumber = `JNV-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 8)}`;
  const complaint = await withTransaction(async (transactionQuery) => {
    const insertResult = await transactionQuery(
      `INSERT INTO complaints (
        complaint_number, citizen_id, category, original_text, english_text,
        generated_description, status, address, latitude, longitude, incident_date
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        complaintNumber,
        citizenId,
        complaintCategory,
        original_complaint ?? description,
        description.trim(),
        llm_generated_text || null,
        location_address.trim(),
        parsedLatitude,
        parsedLongitude,
        incidentDate,
      ]
    );

    for (const image of evidence) {
      await transactionQuery(
        `INSERT INTO complaint_images (complaint_id, image_path, cnn_category, cnn_confidence, vlm_description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          insertResult.insertId,
          image.imagePath,
          image.cnnCategory,
          image.cnnConfidence,
          image.vlmDescription,
        ]
      );
    }

    await logAuditEvent(transactionQuery, {
      userId: citizenId,
      action: 'complaint.created',
      entityType: 'complaint',
      entityId: insertResult.insertId,
      details: { complaint_number: complaintNumber },
    });
    await addComplaintSubmissionReward(transactionQuery, {
      id: insertResult.insertId,
      citizen_id: citizenId,
      created_at: new Date(),
    });

    const result = await transactionQuery(`${COMPLAINT_SELECT} WHERE c.id = ?`, [insertResult.insertId]);
    return (await attachEvidenceFiles(result.rows, transactionQuery))[0];
  });

  res.status(201).json({
    message: 'Complaint submitted successfully',
    complaint,
  });
  if (complaint.latitude !== null && complaint.longitude !== null) {
    setImmediate(() => {
      enrichComplaintLocation(complaint.id).catch((error) => {
        console.error('Asynchronous complaint location enrichment failed:', error.message);
      });
    });
  }
});

export const geocodeComplaintAddress = asyncHandler(async (req, res) => {
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
  if (!address || address.length > 500) {
    return res.status(400).json({ error: 'Enter an address between 1 and 500 characters.' });
  }
  if (address.length < 3) {
    return res.json({ status: 'invalid', results: [] });
  }
  try {
    const outcome = await searchAddressCoordinates(address);
    return res.json(outcome);
  } catch (error) {
    return res.status(503).json({
      status: 'provider_unavailable',
      results: [],
      error: 'Address search is temporarily unavailable. You can continue by pinning the map or submitting the typed address.',
    });
  }
});

export const getMyComplaints = asyncHandler(async (req, res) => {
  const {
    category,
    status,
    from_date: fromDate,
    to_date: toDate,
    progress_min: progressMin,
    progress_max: progressMax,
  } = req.query;
  const conditions = ['c.citizen_id = ?'];
  const params = [req.user.id];

  const categories = Array.isArray(category)
    ? category
    : (category || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (categories.length > 0) {
    conditions.push(`c.category IN (${categories.map(() => '?').join(', ')})`);
    params.push(...categories);
  }

  const statuses = Array.isArray(status)
    ? status
    : (status || '').split(',').map((value) => value.trim()).filter(Boolean);
  const allowedStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
  const validStatuses = [...new Set(statuses.filter((value) => allowedStatuses.includes(value)))];
  if (statuses.length > 0 && validStatuses.length === 0) {
    return res.status(400).json({ error: 'Choose a valid complaint status.' });
  }
  if (validStatuses.length > 0) {
    conditions.push(`c.status IN (${validStatuses.map(() => '?').join(', ')})`);
    params.push(...validStatuses);
  }

  if (fromDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return res.status(400).json({ error: 'From date must use YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at >= ?');
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({ error: 'To date must use YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }

  if (progressMin !== undefined || progressMax !== undefined) {
    const min = progressMin === undefined || progressMin === '' ? 0 : Number(progressMin);
    const max = progressMax === undefined || progressMax === '' ? 100 : Number(progressMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) {
      return res.status(400).json({ error: 'Progress range must be two integers from 0 to 100.' });
    }
    conditions.push(`EXISTS (
      SELECT 1 FROM complaint_progress_updates filtered_progress
      WHERE filtered_progress.complaint_id = c.id
        AND filtered_progress.id = (
          SELECT p.id FROM complaint_progress_updates p
          WHERE p.complaint_id = c.id
          ORDER BY p.created_at DESC, p.id DESC LIMIT 1
        )
        AND filtered_progress.progress_percentage BETWEEN ? AND ?
    )`);
    params.push(min, max);
  }

  const whereClause = ` WHERE ${conditions.join(' AND ')}`;
  const result = await query(
    `${COMPLAINT_SELECT}${whereClause} ORDER BY c.created_at DESC`,
    params
  );
  res.json({ complaints: await attachEvidenceFiles(result.rows) });
});

export const getComplaintById = asyncHandler(async (req, res) => {
  const result = await query(`${COMPLAINT_SELECT} WHERE c.id = ?`, [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Complaint not found' });
  }

  const complaint = result.rows[0];
  if (req.user.role === 'citizen' && String(complaint.citizen_id) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Not authorized to view this complaint' });
  }

  const [complaintWithEvidence] = await attachEvidenceFiles([complaint]);
  const [timeline, progressUpdates] = await Promise.all([
    getStatusTimeline(complaint),
    getProgressUpdates(complaint.id),
  ]);
  complaintWithEvidence.timeline = timeline;
  complaintWithEvidence.progress_updates = progressUpdates;
  if (req.user.role === 'admin') {
    complaintWithEvidence.owner_reward_summary = await getCitizenRewardSummary(complaint.citizen_id);
  }
  complaintWithEvidence.can_citizen_modify = req.user.role === 'citizen'
    && isCitizenComplaintEditable({
      status: complaint.status,
      assigned_admin_id: complaint.assigned_to,
      has_status_history: timeline.some((item) => item.actorRole === 'admin'),
      has_progress_updates: progressUpdates.length > 0,
    });
  res.json({ complaint: complaintWithEvidence });
});

export const replaceComplaintImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Choose an image to replace the existing photo.' });
  }

  let newImagePath;
  try {
    newImagePath = toRelativeUploadPath(req.file.filename);
  } catch (error) {
    const cleanupError = await removeUploadedFile(req.file.filename);
    if (cleanupError) console.error('Could not remove rejected replacement image:', cleanupError.message);
    return res.status(400).json({ error: error.message });
  }

  let imageStored = false;
  try {
    const access = await getCitizenComplaintMutationState(query, req.params.id, req.user.id);
    if (access.error) {
      return res.status(access.statusCode).json({ error: access.error });
    }

    const existingImage = await query(
      'SELECT id FROM complaint_images WHERE id = ? AND complaint_id = ?',
      [req.params.imageId, req.params.id]
    );
    if (existingImage.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint image not found' });
    }

    const evidence = {
      filename: req.file.filename,
      imagePath: newImagePath,
      mimetype: req.file.mimetype,
    };
    let classification;
    try {
      classification = await classifyUploadedImage(evidence);
    } catch (error) {
      classification = classificationFailureForReview(error);
      console.error(
        `CNN classification failed for replacement image ${req.file.filename}; marking it for review:`,
        error.message
      );
    }

    const updateResult = await withTransaction(async (transactionQuery) => {
      const current = await getCitizenComplaintMutationState(
        transactionQuery,
        req.params.id,
        req.user.id,
        true
      );
      if (current.error) return current;

      const imageResult = await transactionQuery(
        `SELECT id, image_path FROM complaint_images
         WHERE id = ? AND complaint_id = ? FOR UPDATE`,
        [req.params.imageId, req.params.id]
      );
      if (imageResult.rows.length === 0) {
        return { statusCode: 404, error: 'Complaint image not found' };
      }

      const previousImagePath = imageResult.rows[0].image_path;
      resolveUploadedFilePath(previousImagePath);
      await transactionQuery(
        `UPDATE complaint_images
         SET image_path = ?, cnn_category = ?, cnn_confidence = ?, vlm_description = NULL
         WHERE id = ? AND complaint_id = ?`,
        [
          newImagePath,
          classification.prediction,
          classification.confidence,
          req.params.imageId,
          req.params.id,
        ]
      );
      await logAuditEvent(transactionQuery, {
        userId: req.user.id,
        action: 'complaint.image_replaced',
        entityType: 'complaint',
        entityId: req.params.id,
        details: { image_id: req.params.imageId },
      });
      return { previousImagePath };
    });

    if (updateResult.error) {
      return res.status(updateResult.statusCode).json({ error: updateResult.error });
    }

    imageStored = true;
    const cleanupWarnings = await removeStoredFiles(
      [updateResult.previousImagePath],
      'replacing an image'
    );
    res.json({
      message: 'Complaint image replaced and classified.',
      cnn_category: classification.prediction,
      cnn_confidence: classification.confidence,
      cleanup_warning: cleanupWarnings.length > 0,
    });
  } finally {
    if (!imageStored) {
      const cleanupError = await removeUploadedFile(newImagePath);
      if (cleanupError) console.error('Could not remove unused replacement image:', cleanupError.message);
    }
  }
});

export const deleteComplaintImage = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (transactionQuery) => {
    const current = await getCitizenComplaintMutationState(
      transactionQuery,
      req.params.id,
      req.user.id,
      true
    );
    if (current.error) return current;

    const images = await transactionQuery(
      `SELECT id, image_path FROM complaint_images
       WHERE complaint_id = ? FOR UPDATE`,
      [req.params.id]
    );
    const image = images.rows.find((item) => String(item.id) === String(req.params.imageId));
    if (!image) return { statusCode: 404, error: 'Complaint image not found' };
    if (images.rows.length <= 1) {
      return {
        statusCode: 409,
        error: 'A complaint must keep at least one photo. Replace it or delete the complaint instead.',
      };
    }

    resolveUploadedFilePath(image.image_path);
    await transactionQuery(
      'DELETE FROM complaint_images WHERE id = ? AND complaint_id = ?',
      [req.params.imageId, req.params.id]
    );
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'complaint.image_removed',
      entityType: 'complaint',
      entityId: req.params.id,
      details: { image_id: req.params.imageId },
    });
    return { imagePath: image.image_path };
  });

  if (result.error) {
    return res.status(result.statusCode).json({ error: result.error });
  }

  const cleanupWarnings = await removeStoredFiles([result.imagePath], 'removing an image');
  res.json({
    message: 'Complaint image removed.',
    cleanup_warning: cleanupWarnings.length > 0,
  });
});

export const deleteComplaint = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await withTransaction(async (transactionQuery) => {
      const current = await getCitizenComplaintMutationState(
        transactionQuery,
        req.params.id,
        req.user.id,
        true
      );
      if (current.error) return current;

      const rewards = await transactionQuery(
        'SELECT id FROM reward_transactions WHERE complaint_id = ? FOR UPDATE',
        [req.params.id]
      );

      const images = await transactionQuery(
        'SELECT image_path FROM complaint_images WHERE complaint_id = ? FOR UPDATE',
        [req.params.id]
      );
      const imagePaths = images.rows.map((image) => {
        resolveUploadedFilePath(image.image_path);
        return image.image_path;
      });
      if (rewards.rows.length > 0) {
        await transactionQuery(
          'UPDATE reward_transactions SET complaint_id = NULL WHERE complaint_id = ?',
          [req.params.id]
        );
      }
      const deleteResult = await transactionQuery(
        'DELETE FROM complaints WHERE id = ? AND citizen_id = ?',
        [req.params.id, req.user.id]
      );
      if (deleteResult.affectedRows !== 1) {
        return { statusCode: 404, error: 'Complaint not found' };
      }

      await logAuditEvent(transactionQuery, {
        userId: req.user.id,
        action: 'complaint.deleted_by_citizen',
        entityType: 'complaint',
        entityId: req.params.id,
        details: {
          complaint_number: current.complaint.complaint_number,
          image_count: imagePaths.length,
          reward_transactions_detached: rewards.rows.length,
        },
      });
      return {
        imagePaths,
        rewardTransactionsDetached: rewards.rows.length,
      };
    });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'This complaint has related records and cannot be deleted.',
      });
    }
    throw error;
  }

  if (result.error) {
    return res.status(result.statusCode).json({ error: result.error });
  }

  const cleanupWarnings = await removeStoredFiles(result.imagePaths, 'deleting a complaint');
  res.json({
    message: 'Complaint deleted.',
    reward_transactions_detached: result.rewardTransactionsDetached,
    cleanup_warning: cleanupWarnings.length > 0,
  });
});

export const getAllComplaints = asyncHandler(async (req, res) => {
  const {
    status,
    category,
    citizen,
    from_date: fromDate,
    to_date: toDate,
    progress_min: progressMin,
    progress_max: progressMax,
    page = 1,
    limit = 20,
  } = req.query;
  const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const conditions = [];
  const params = [];

  const statuses = Array.isArray(status) ? status : (status || '').split(',').map((value) => value.trim()).filter(Boolean);
  const allowedStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
  const validStatuses = [...new Set(statuses.filter((value) => allowedStatuses.includes(value)))];
  if (statuses.length > 0 && validStatuses.length === 0) {
    return res.status(400).json({ error: 'Choose a valid complaint status.' });
  }
  if (validStatuses.length > 0) {
    conditions.push(`c.status IN (${validStatuses.map(() => '?').join(', ')})`);
    params.push(...validStatuses);
  }

  const categories = Array.isArray(category) ? category : (category || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (categories.length > 0) {
    conditions.push(`c.category IN (${categories.map(() => '?').join(', ')})`);
    params.push(...categories);
  }

  if (typeof citizen === 'string' && citizen.trim()) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    const citizenPattern = `%${citizen.trim()}%`;
    params.push(citizenPattern, citizenPattern);
  }

  if (fromDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return res.status(400).json({ error: 'From date must use YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at >= ?');
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({ error: 'To date must use YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(toDate);
  }
  if (progressMin !== undefined || progressMax !== undefined) {
    const min = progressMin === undefined || progressMin === '' ? 0 : Number(progressMin);
    const max = progressMax === undefined || progressMax === '' ? 100 : Number(progressMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) {
      return res.status(400).json({ error: 'Progress range must be two integers from 0 to 100.' });
    }
    conditions.push(`EXISTS (
      SELECT 1 FROM complaint_progress_updates filtered_progress
      WHERE filtered_progress.complaint_id = c.id
        AND filtered_progress.id = (
          SELECT p.id FROM complaint_progress_updates p
          WHERE p.complaint_id = c.id
          ORDER BY p.created_at DESC, p.id DESC LIMIT 1
        )
        AND filtered_progress.progress_percentage BETWEEN ? AND ?
    )`);
    params.push(min, max);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(
    `SELECT COUNT(*) AS total FROM complaints c LEFT JOIN users u ON u.id = c.citizen_id${whereClause}`,
    params
  );
  params.push(parsedLimit, (parsedPage - 1) * parsedLimit);
  const result = await query(
    `${COMPLAINT_SELECT}${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    params
  );

  res.json({
    complaints: await attachEvidenceFiles(result.rows),
    page: parsedPage,
    limit: parsedLimit,
    total: Number(countResult.rows[0]?.total || 0),
  });
});

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, assigned_to, resolution_notes } = req.body || {};
  const hasAssignedAdmin = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_to');
  const allowedStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Choose a valid complaint status' });
  }

  const complaint = await withTransaction(async (transactionQuery) => {
    const currentResult = await transactionQuery(
      'SELECT id, citizen_id, status, assigned_admin_id, resolved_at FROM complaints WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (currentResult.rows.length === 0) return null;

    const current = currentResult.rows[0];
    const assignedAdminId = hasAssignedAdmin
      ? (assigned_to === null || assigned_to === '' ? null : assigned_to)
      : current.assigned_admin_id;

    if (hasAssignedAdmin && assignedAdminId !== null) {
      const adminResult = await transactionQuery(
        'SELECT id FROM users WHERE id = ? AND role = ? AND is_active = TRUE',
        [assignedAdminId, 'admin']
      );
      if (adminResult.rows.length === 0) {
        const error = new Error('The assigned user must be an active administrator.');
        error.statusCode = 400;
        throw error;
      }
    }

    await transactionQuery(
      `UPDATE complaints
       SET status = ?, assigned_admin_id = ?,
           resolved_at = CASE WHEN ? = 'resolved' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END
       WHERE id = ?`,
      [status, assignedAdminId, status, req.params.id]
    );
    await transactionQuery(
      `INSERT INTO complaint_status_history (complaint_id, admin_id, old_status, new_status, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, current.status, status, resolution_notes || null]
    );
    if (status === 'resolved' && current.status !== 'resolved') {
      await complaintRewardForResolution(transactionQuery, {
        id: current.id,
        citizen_id: current.citizen_id,
        status,
        resolved_at: new Date(),
      });
    }
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'complaint.status_updated',
      entityType: 'complaint',
      entityId: req.params.id,
      details: { old_status: current.status, new_status: status, reason: resolution_notes || null },
    });

    const updatedResult = await transactionQuery(`${COMPLAINT_SELECT} WHERE c.id = ?`, [req.params.id]);
    const [updatedComplaint] = await attachEvidenceFiles(updatedResult.rows, transactionQuery);
    return updatedComplaint;
  });

  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found' });
  }

  complaint.timeline = await getStatusTimeline(complaint);
  res.json({ message: 'Complaint updated', complaint });
});

export const createComplaintProgressUpdate = asyncHandler(async (req, res) => {
  const { stage, progress_percentage: progressPercentage, remarks } = req.body || {};
  if (!PROGRESS_STAGES.includes(stage)) {
    return res.status(400).json({ error: 'Choose a valid complaint progress stage' });
  }
  if (!Number.isInteger(progressPercentage) || progressPercentage < 0 || progressPercentage > 100) {
    return res.status(400).json({ error: 'Progress percentage must be an integer from 0 to 100' });
  }
  if (stage === 'Resolved' && progressPercentage !== 100) {
    return res.status(400).json({ error: 'Resolved progress requires 100% completion' });
  }
  if (typeof remarks !== 'string' || !remarks.trim() || remarks.length > 5000) {
    return res.status(400).json({ error: 'Progress remarks of 1 to 5000 characters are required' });
  }

  const result = await withTransaction(async (transactionQuery) => {
    const complaintResult = await transactionQuery(
      'SELECT id, citizen_id, status, resolved_at FROM complaints WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (complaintResult.rows.length === 0) return null;

    const currentComplaint = complaintResult.rows[0];
    const insertResult = await transactionQuery(
      `INSERT INTO complaint_progress_updates
        (complaint_id, admin_id, stage, progress_percentage, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, stage, progressPercentage, remarks.trim()]
    );

    let complaintStatus = currentComplaint.status;
    if (stage === 'Resolved' || progressPercentage === 100) {
      await transactionQuery(
        `UPDATE complaints
         SET status = 'resolved', resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [req.params.id]
      );
      if (currentComplaint.status !== 'resolved') {
        await transactionQuery(
          `INSERT INTO complaint_status_history (complaint_id, admin_id, old_status, new_status, reason)
           VALUES (?, ?, ?, 'resolved', ?)`,
          [req.params.id, req.user.id, currentComplaint.status, remarks.trim()]
        );
        complaintStatus = 'resolved';
          await complaintRewardForResolution(transactionQuery, {
           id: currentComplaint.id,
           citizen_id: currentComplaint.citizen_id,
           status: 'resolved',
           resolved_at: new Date(),
          });
      }
    }

    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'complaint.progress_updated',
      entityType: 'complaint',
      entityId: req.params.id,
      details: { stage, progress_percentage: progressPercentage },
    });

    const progressResult = await transactionQuery(
      `SELECT p.id, p.complaint_id, p.admin_id, p.stage, p.progress_percentage,
              p.remarks, p.created_at, u.full_name AS admin_name
       FROM complaint_progress_updates p
       JOIN users u ON u.id = p.admin_id
       WHERE p.id = ?`,
      [insertResult.insertId]
    );
    return {
      progressUpdate: progressResult.rows[0],
      complaintStatus,
    };
  });

  if (!result) {
    return res.status(404).json({ error: 'Complaint not found' });
  }
  res.status(201).json({
    message: 'Complaint progress update saved',
    progress_update: result.progressUpdate,
    complaint_status: result.complaintStatus,
  });
});

export const getComplaintStats = asyncHandler(async (req, res) => {
  const [summary, categoryResult] = await Promise.all([
    getComplaintSummary(),
    query('SELECT category, COUNT(*) AS count FROM complaints GROUP BY category'),
  ]);
  res.json({ ...summary, byCategory: categoryResult.rows });
});
