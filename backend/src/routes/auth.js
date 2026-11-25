import { Router } from 'express';
import { register, registerAdmin, login, logout, me } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/admin/register', registerAdmin);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);

export default router;
