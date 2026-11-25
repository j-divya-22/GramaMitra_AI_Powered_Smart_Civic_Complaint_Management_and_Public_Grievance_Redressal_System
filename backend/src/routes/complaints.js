import { Router } from 'express';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import {
  createComplaint,
  deleteComplaint,
  deleteComplaintImage,
  getMyComplaints,
  getComplaintById,
  getAllComplaints,
  updateComplaintStatus,
  createComplaintProgressUpdate,
  getComplaintStats,
  geocodeComplaintAddress,
  replaceComplaintImage,
} from '../controllers/complaintController.js';
import { authenticateToken, requireAdmin, requireCitizen } from '../middleware/auth.js';
import { getUploadDirectory } from '../utils/uploadPaths.js';

const router = Router();
const MAX_REPLACEMENT_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const replacementImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      try {
        const uploadDirectory = getUploadDirectory();
        fs.mkdirSync(uploadDirectory, { recursive: true });
        callback(null, uploadDirectory);
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, callback) => callback(
      null,
      `${randomUUID()}${IMAGE_EXTENSIONS.get(file.mimetype) || '.image'}`
    ),
  }),
  limits: { fileSize: MAX_REPLACEMENT_IMAGE_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!IMAGE_EXTENSIONS.has(file.mimetype)) {
      return callback(new Error('Choose a JPG, PNG, or WebP image.'));
    }
    callback(null, true);
  },
});

const uploadReplacementImage = (req, res, next) => {
  replacementImageUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const statusCode = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : 400;
    return res.status(statusCode).json({ error: error.message });
  });
};

router.post('/', authenticateToken, createComplaint);
router.post('/geocode-address', authenticateToken, geocodeComplaintAddress);
router.get('/mine', authenticateToken, getMyComplaints);
router.get('/', authenticateToken, requireAdmin, getAllComplaints);
router.get('/stats', authenticateToken, requireAdmin, getComplaintStats);
router.get('/:id', authenticateToken, getComplaintById);
router.put('/:id/images/:imageId', authenticateToken, requireCitizen, uploadReplacementImage, replaceComplaintImage);
router.delete('/:id/images/:imageId', authenticateToken, requireCitizen, deleteComplaintImage);
router.delete('/:id', authenticateToken, requireCitizen, deleteComplaint);
router.post('/:id/progress', authenticateToken, requireAdmin, createComplaintProgressUpdate);
router.patch('/:id/status', authenticateToken, requireAdmin, updateComplaintStatus);

export default router;
