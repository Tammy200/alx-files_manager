import AppController from '../controllers/AppController';
import express from 'express';

const router = express.Router();

router.get('/status', AppController.getStatus);

router.get('/stats', AppController.getStats);

export default router;
