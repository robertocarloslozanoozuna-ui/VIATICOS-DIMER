import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';

const app = createApp();
registerApprovalRoutes(app);

export default app;
