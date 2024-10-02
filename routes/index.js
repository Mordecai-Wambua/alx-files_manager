import { Router } from 'express';
import { getStats, getStatus } from '../controllers/AppController';
import { postNew, getMe } from '../controllers/UsersController';
import { getConnect, getDisconnect } from '../controllers/AuthController';
import { postUpload, getShow, getIndex } from '../controllers/FilesController';

const router = Router();

router.get('/status', getStatus);
router.get('/stats', getStats);
router.post('/users', postNew);

router.get('/connect', getConnect);
router.get('/disconnect', getDisconnect);
router.get('/users/me', getMe);

router.post('/files', postUpload);
router.get('/files', getIndex);
router.post('/files/:id', getShow);

export default router;
