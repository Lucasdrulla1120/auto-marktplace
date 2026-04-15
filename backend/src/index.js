require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./utils/prisma');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const adminRoutes = require('./routes/admin');
const plansRoutes = require('./routes/plans');
const paymentsRoutes = require('./routes/payments');
const storesRoutes = require('./routes/stores');

const app = express();
const PORT = Number(process.env.PORT || 4000);

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

app.use(cors(buildCorsOptions()));
app.options('*', cors(buildCorsOptions()));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API online', timestamp: new Date().toISOString(), version: 'v3.7-production-mercadopago-ready' });
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
