import { Router } from 'express';

const router = Router();

router.post('/outreach', (req, res) => {
  res.status(501).json({ message: 'Not implemented - Phase 4' });
});

export default router;
