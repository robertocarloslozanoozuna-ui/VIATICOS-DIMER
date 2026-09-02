import { createApp } from '../server/app.js';
import { registerApprovalRoutes } from '../server/approvalRoutes.js';
import { registerAdminRequestRoutes } from '../server/adminRequestRoutes.js';
import { registerRequestCreationRoutes } from '../server/requestCreationRoutes.js';

const app = createApp();
registerAdminRequestRoutes(app);
registerRequestCreationRoutes(app);
registerApprovalRoutes(app);

export default app;
