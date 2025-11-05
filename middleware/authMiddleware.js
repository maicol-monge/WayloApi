const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Token requerido' });
    const token = auth.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'changeme';
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    }
    // Verify session exists and not revoked
    const q = await db.query('SELECT * FROM token_sesion WHERE token=$1 AND revoked=$2 LIMIT 1', [token, 'N']);
    if (q.rows.length === 0) return res.status(401).json({ success: false, message: 'Sesión inválida' });
    // Verify role
    if (!payload.rol || (payload.rol || '').toLowerCase() !== 'admin') return res.status(403).json({ success: false, message: 'Requiere rol admin' });
    req.user = payload;
    next();
  } catch (err) {
    console.error('[middleware] requireAdmin error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { requireAdmin };
