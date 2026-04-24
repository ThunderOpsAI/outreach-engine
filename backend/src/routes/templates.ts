import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.status(501).json({ message: 'Not implemented - Phase 5' });
});

export default router;
