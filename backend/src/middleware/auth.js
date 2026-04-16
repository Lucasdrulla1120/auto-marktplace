const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

async function resolveUserFromToken(token) {
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  return user || null;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

async function authRequired(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: 'Token ausente.' });

  try {
    const user = await resolveUserFromToken(token);
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado.' });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

async function optionalAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await resolveUserFromToken(token);
  } catch (error) {
    req.user = null;
  }
  return next();
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  }
  return next();
}

module.exports = { authRequired, optionalAuth, adminRequired };
