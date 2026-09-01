import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';

const app = createApp();
registerAdminRequestRoutes(app);
registerApprovalRoutes(app);

export default app;
