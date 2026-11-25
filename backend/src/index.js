import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import uploadRoutes from './routes/upload.js';
import knowledgeRoutes from './routes/knowledge.js';
import rewardRoutes from './routes/rewards.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectDB } from './config/db.js';

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
  throw new Error('Set JWT_SECRET to a private random value of at least 32 characters before starting the backend.');
}

const app = express();
const PORT = process.env.PORT || 5000;

await connectDB();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Gramamitra backend', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ service: 'Gramamitra API', version: '1.0.0', tagline: 'Giving Every Citizen a Voice.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/rewards', rewardRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Gramamitra backend running on port ${PORT}`);
});

export default app;
