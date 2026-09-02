import express from 'express';
import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';
import { requestNotificationHandler } from '../server/requestNotificationRoute.js';

const app = express();

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

export default app;
