// Local development server for API routes
// Run with: node server-local.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Import API handlers
import adminData from './api/admin-data.js';
import circleRequests from './api/circle-requests.js';
import communities from './api/communities.js';
import deleteHandler from './api/delete.js';
import forgotPassword from './api/forgot-password.js';
import login from './api/login.js';
import me from './api/me.js';
import moderation from './api/moderation.js';
import shop from './api/shop.js';
import signup from './api/signup.js';
import updateProfile from './api/update-profile.js';
import upload from './api/upload.js';
import verifyStudent from './api/verify-student.js';

// Mount API routes
app.all('/api/admin-data', adminData);
app.all('/api/circle-requests/:action', (req, res) => {
  // Map Express params to Vercel-style query for compatibility
  req.query = { ...req.query, action: req.params.action };
  circleRequests(req, res);
});
app.all('/api/circle-requests', circleRequests); // GET list
app.all('/api/communities', communities);
app.all('/api/delete', deleteHandler);
app.all('/api/forgot-password', forgotPassword);
app.all('/api/login', login);
app.all('/api/me', me);
app.all('/api/moderation', moderation);
app.all('/api/shop', shop);
app.all('/api/signup', signup);
app.all('/api/update-profile', updateProfile);
app.all('/api/upload', upload);
app.all('/api/verify-student', verifyStudent);

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api/*`);
});
