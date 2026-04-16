require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./utils/prisma');
const { securityHeaders } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const adminRoutes = require('./routes/admin');
const plansRoutes = require('./routes/plans');
const paymentsRoutes = require('./routes/payments');
const storesRoutes = require('./routes/stores');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ENABLE_REQUEST_LOGS = String(process.env.ENABLE_REQUEST_LOGS || 'false') === 'true';

function buildCorsOptions() {
  const rawOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '*';
  if (rawOrigins.trim() === '*' || rawOrigins.trim() === '') {
    return { origin: true };
  }

  const allowedOrigins = rawOrigins
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS bloqueado para origem: ${origin}`));
    },
  };
}

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors(buildCorsOptions()));
app.options('*', cors(buildCorsOptions()));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '15mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '15mb' }));

if (ENABLE_REQUEST_LOGS) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
    });
    next();
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API online',
    timestamp: new Date().toISOString(),
    version: 'v5.0.0-regional-sales-ready',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/stores', storesRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((error, req, res, next) => {
  if (error?.message?.startsWith('CORS bloqueado')) {
    return res.status(403).json({ message: error.message });
  }
  console.error('Erro não tratado:', error);
  return res.status(500).json({ message: 'Erro interno do servidor.' });
});

async function start() {
  try {
    await prisma.$connect();
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`Servidor rodando em http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar o backend:', error);
    process.exit(1);
  }
}

start();
