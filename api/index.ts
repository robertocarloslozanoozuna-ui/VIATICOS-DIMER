import express from 'express';
import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';
import { requestNotificationHandler } from '../server/requestNotificationRoute.js';

const app = express();

// This route must be registered before createApp(), because createApp()
// contains the application fallback. Express evaluates routes in registration order.
app.post('/api/requests/:id/notify', requestNotificationHandler);

const mainApp = createApp();
registerAdminRequestRoutes(mainApp);
registerRequestCreationRoutes(mainApp);
registerApprovalRoutes(mainApp);

app.use(mainApp);

export default app;
