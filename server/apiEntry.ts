import { createApp } from './app';
import { securityGate } from './securityGate.js';

const app = createApp();

const handler = (req: any, res: any) => securityGate(req, res, (err?: unknown) => {
  if (err) return app(req, res);
  return app(req, res);
});

export default handler;
export { app, handler };
