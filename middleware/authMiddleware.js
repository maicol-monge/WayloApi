const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

function verifyTokenFromHeader(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return { error: 'Token requerido' };
  const token = auth.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'changeme';
  try {
    const payload = jwt.verify(token, secret);
    return { token, payload };
  } catch (err) {
    return { error: 'Token inválido o expirado' };
  }
}

async function validateSessionToken(token) {
  const q = await db.query('SELECT * FROM token_sesion WHERE token=$1 AND revoked=$2 LIMIT 1', [token, 'N']);
  return q.rows.length > 0 ? q.rows[0] : null;
}

async function requireAdmin(req, res, next) {
  try {
    const vt = verifyTokenFromHeader(req);
    if (vt.error) return res.status(401).json({ success: false, message: vt.error });
    const { token, payload } = vt;
    const session = await validateSessionToken(token);
    if (!session) return res.status(401).json({ success: false, message: 'Sesión inválida' });
    // Verify role
    if (!payload.rol || (payload.rol || '').toLowerCase() !== 'admin') return res.status(403).json({ success: false, message: 'Requiere rol admin' });
    req.user = payload;
    next();
  } catch (err) {
    console.error('[middleware] requireAdmin error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

async function requireAuth(req, res, next) {
  try {
    const vt = verifyTokenFromHeader(req);
    if (vt.error) return res.status(401).json({ success: false, message: vt.error });
    const { token, payload } = vt;
    const session = await validateSessionToken(token);
    if (!session) return res.status(401).json({ success: false, message: 'Sesión inválida' });
    req.user = payload;
    next();
  } catch (err) {
    console.error('[middleware] requireAuth error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

function ensureSameUserParam(paramName) {
  return (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });
      if (String(req.params[paramName]) !== String(req.user.id_usuario)) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }
      next();
    } catch (err) {
      console.error('[middleware] ensureSameUserParam error:', err);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };
}

module.exports = { requireAdmin, requireAuth, ensureSameUserParam };
