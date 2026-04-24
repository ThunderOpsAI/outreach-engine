import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestId } from './src/middleware/requestId.js';
import { auth } from './src/middleware/auth.js';
import { rateLimit } from './src/middleware/rateLimit.js';
import healthRoute from './src/routes/health.js';
import generateRoute from './src/routes/generate.js';
import templatesRoute from './src/routes/templates.js';

dotenv.config({ path: './backend/.env' });

const app = express();
const port = process.env.PORT || 3001;

// Global Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestId);

// Health route (unauthenticated)
app.use('/health', healthRoute);

// Auth + Rate Limit for all /api/v1 routes
app.use('/api/v1', auth, rateLimit);

// Mount API routes
app.use('/api/v1/generate', generateRoute);
app.use('/api/v1/templates', templatesRoute);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
