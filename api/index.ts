import express, { type NextFunction, type Request, type Response } from 'express';
import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';
import { requestNotificationHandler } from '../server/requestNotificationRoute.js';
import { logSystemError, registerProcessErrorLogging } from '../server/errorLogger.js';

const app = express();

// Global error telemetry. It does not alter successful requests and never
// exposes credentials, cookies or authorization headers in the log.
registerProcessErrorLogging();

app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      logSystemError(new Error(`HTTP ${res.statusCode}`), req, {
        source: 'http-response',
        statusCode: res.statusCode,
      });
    }
  });
  next();
});

// IMPORTANT: createApp() contains the application's final fallback/404 handler.
// Any routes that are registered after createApp() may never be reached.
// Keep externally registered routes on this outer app, before app.use(mainApp).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initial request notification endpoint.
app.post('/api/requests/:id/notify', requestNotificationHandler);

// Approval links are opened directly from email, so they must also be
// registered before createApp()'s fallback. This covers both GET decision
// pages and POST decision submissions.
registerApprovalRoutes(app);

const mainApp = createApp();
registerAdminRequestRoutes(mainApp);
registerRequestCreationRoutes(mainApp);

app.use(mainApp);

// Last-resort Express error handler for errors that reach the outer app.
// Existing route behavior remains unchanged because normal responses are not
// intercepted here.
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  logSystemError(error, req, { source: 'express-error', statusCode: 500 });
  if (res.headersSent) return next(error);
  return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
});

export default app;
