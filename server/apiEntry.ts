import express from 'express';
import { createApp } from './app';
import { securityGate } from './securityGate.js';

const app = createApp();
const handler = express();
handler.set('trust proxy', 1);
handler.use(securityGate);
handler.use(app);

export default handler;
export { app, handler };
