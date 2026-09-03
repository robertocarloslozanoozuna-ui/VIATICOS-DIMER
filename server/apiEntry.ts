import express from 'express';
import { createApp } from './app.js';
import { securityGate } from './securityGate.js';

const app = createApp();
const handler = express();
handler.set('trust proxy', 1);
handler.use(express.json({ limit: '10mb' }));
handler.use(securityGate);
handler.use(app);

export default handler;
export { app, handler, createApp };
