import { Router } from 'express';
import multer from 'multer';
import { classifyImage, generateComplaintText, chat, translateToEnglish } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Choose a JPG, PNG, or WebP image.'));
    }
    callback(null, true);
  },
});
const classifyUpload = (req, res, next) => {
  imageUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({ error: error.message });
  });
};

router.post('/classify', authenticateToken, classifyUpload, classifyImage);
router.post('/generate-complaint', authenticateToken, generateComplaintText);
router.post('/translate', authenticateToken, translateToEnglish);
router.post('/chat', authenticateToken, chat);

export default router;
