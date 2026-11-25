import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/documents', authenticateToken, requireAdmin, (req, res) => {
  res.json({ documents: [] });
});

router.post('/documents', authenticateToken, requireAdmin, (req, res) => {
  res.status(201).json({ message: 'Document endpoint ready', document: null });
});

export default router;
