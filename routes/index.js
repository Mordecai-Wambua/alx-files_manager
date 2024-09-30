import { Router } from 'express';
import { getStats, getStatus } from '../controllers/AppController';
import { postNew } from '../controllers/UsersController';

const router = Router();

router.get('/status', getStatus);
router.get('/stats', getStats);
router.post('/users', postNew);

export default router;
