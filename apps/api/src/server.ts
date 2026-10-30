import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeFirebaseAdmin } from './lib/firebase-admin';
import { authRouter } from './routes/auth';
import { storeRouter } from './routes/stores';
import { healthRouter } from './routes/health';
import { medicineRouter } from './routes/medicines';
import { batchRouter } from './routes/batches';
import { importRouter } from './routes/imports';
import { supplierRouter } from './routes/suppliers';
import { purchaseRouter } from './routes/purchases';
import { doctorRouter } from './routes/doctors';
import { employeeRouter } from './routes/employees';
import { billRouter } from './routes/bills';
import { expenseRouter } from './routes/expenses';
import { dashboardRouter } from './routes/dashboard';
import { reportRouter } from './routes/reports';
import { jobRouter } from './routes/jobs';
import { notificationRouter } from './routes/notifications';
import { auditLogRouter } from './routes/audit-logs';
import { vaultRouter } from './routes/vault';
import { rateLimiter } from './middleware/rate-limiter';
import { sanitizeRequest, secureHeaders } from './middleware/security';
import { errorHandler } from './middleware/error-handler';
import { SchedulerService } from './services/SchedulerService';

initializeFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(secureHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeRequest);

// Global API Rate Limiter: 300 requests per minute
app.use('/api', rateLimiter({ maxRequests: 300, windowSeconds: 60 }));

app.use('/api/v1/admin', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/stores', storeRouter);
app.use('/api/v1/inventory/medicines', medicineRouter);
app.use('/api/v1/inventory/batches', batchRouter);
app.use('/api/v1/imports', importRouter);
app.use('/api/v1/suppliers', supplierRouter);
app.use('/api/v1/purchases', purchaseRouter);
app.use('/api/v1/doctors', doctorRouter);
app.use('/api/v1/employees', employeeRouter);
app.use('/api/v1/bills', billRouter);
app.use('/api/v1/expenses', expenseRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/jobs', jobRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/audit-logs', auditLogRouter);
app.use('/api/v1/vault', vaultRouter);

app.use(errorHandler);

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`PulseClinic API running on port ${PORT}`);
    SchedulerService.start();
  });
}

export default app;
