import { Router } from 'express';
import {
  getDashboardStats,
  getDepartments,
  createDepartment,
  updateDepartment,
  getKnowledgeDocuments,
  createKnowledgeDocument,
  getAuditLogs,
  getRegionalOptions,
  getRegionalInsights,
  enrichRegionalLocations,
} from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticateToken, requireAdmin, getDashboardStats);
router.get('/departments', authenticateToken, requireAdmin, getDepartments);
router.post('/departments', authenticateToken, requireAdmin, createDepartment);
router.put('/departments/:id', authenticateToken, requireAdmin, updateDepartment);
router.get('/knowledge', authenticateToken, requireAdmin, getKnowledgeDocuments);
router.post('/knowledge', authenticateToken, requireAdmin, createKnowledgeDocument);
router.get('/audit-logs', authenticateToken, requireAdmin, getAuditLogs);
router.get('/regional/options', authenticateToken, requireAdmin, getRegionalOptions);
router.get('/regional/insights', authenticateToken, requireAdmin, getRegionalInsights);
router.post('/regional/enrich', authenticateToken, requireAdmin, enrichRegionalLocations);

export default router;
