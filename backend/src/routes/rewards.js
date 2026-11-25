import { Router } from 'express';
import { authenticateToken, requireAdmin, requireCitizen } from '../middleware/auth.js';
import {
  getMyRewards,
  getAdminRewards,
  getAdminCitizenRewards,
  requestRewardWithdrawal,
  getAdminWithdrawalRequests,
  reviewRewardWithdrawal,
  initiateRewardPayment,
  confirmRewardPayment,
} from '../controllers/rewardController.js';

const router = Router();

router.get('/mine', authenticateToken, requireCitizen, getMyRewards);
router.post('/withdrawals', authenticateToken, requireCitizen, requestRewardWithdrawal);

router.get('/admin/citizens', authenticateToken, requireAdmin, getAdminRewards);
router.get('/admin/citizens/:citizenId', authenticateToken, requireAdmin, getAdminCitizenRewards);
router.get('/admin/withdrawals', authenticateToken, requireAdmin, getAdminWithdrawalRequests);
router.post('/admin/withdrawals/:withdrawalId/review', authenticateToken, requireAdmin, reviewRewardWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/initiate', authenticateToken, requireAdmin, initiateRewardPayment);
router.post('/admin/withdrawals/:withdrawalId/confirm', authenticateToken, requireAdmin, confirmRewardPayment);

export default router;
