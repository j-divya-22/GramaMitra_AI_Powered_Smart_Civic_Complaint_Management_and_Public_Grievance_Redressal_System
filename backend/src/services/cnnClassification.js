import path from 'node:path';
import { readFile } from 'node:fs/promises';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const CNN_CLASS_NAMES = [
  'damaged_footpath',
  'damaged_road_sign',
  'electrical_hazard',
  'infrastructure',
  'normal',
  'open_manhole_borewell',
  'road_damage',
  'roadside_garbage',
  'streetlight_faults',
  'vegetation',
  'waterlogging',
];
const CNN_CLASSES = new Set(CNN_CLASS_NAMES);
const COMPLAINT_CATEGORIES = new Set([...CNN_CLASS_NAMES, 'other']);
const IMAGE_EXTENSIONS = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const createServiceError = (message, statusCode = 503) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const isSupportedComplaintCategory = (category) => COMPLAINT_CATEGORIES.has(category);

export const getSelectedComplaintCategory = (category) => (
  typeof category === 'string' && category.trim() ? category.trim() : null
);

export const getImageMimeType = (file) => {
  if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
    return file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  }
  return IMAGE_EXTENSIONS.get(path.extname(file.filename).toLowerCase()) || null;
};

export const classifyImageBuffer = async (buffer, { filename, mimetype }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createServiceError('An image file is required.', 400);
  }
  if (!IMAGE_MIME_TYPES.has(mimetype)) {
    throw createServiceError('Only JPG, PNG, and WebP images can be classified.', 400);
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimetype }), filename || 'evidence');

  let response;
  try {
    response = await fetch(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/classify`,
      { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) }
    );
  } catch (error) {
    throw createServiceError(`CNN service is unavailable: ${error.message}`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw createServiceError('CNN service returned an invalid response.');
  }
  if (!response.ok) {
    throw createServiceError(
      result.error || 'CNN service could not classify the uploaded image.',
      response.status === 400 ? 400 : response.status === 413 ? 413 : 503
    );
  }
  if (
    typeof result.prediction !== 'string'
    || !CNN_CLASSES.has(result.prediction)
    || !Number.isFinite(result.confidence)
    || result.confidence < 0
    || result.confidence > 1
    || typeof result.needs_review !== 'boolean'
  ) {
    throw createServiceError('CNN service returned an invalid classification result.');
  }
  return result;
};

export const classificationFailureForReview = (error) => {
  if (error?.statusCode !== 503) throw error;
  return {
    prediction: 'needs_review',
    confidence: null,
    needs_review: true,
    review_reason: 'classification_unavailable',
  };
};

export const classifyUploadedImage = async (evidence) => {
  const fullPath = path.resolve(process.cwd(), evidence.imagePath);
  let buffer;
  try {
    buffer = await readFile(fullPath);
  } catch {
    throw createServiceError(`Uploaded image could not be read: ${evidence.filename}`, 400);
  }

  return classifyImageBuffer(buffer, {
    filename: evidence.filename,
    mimetype: evidence.mimetype,
  });
};

