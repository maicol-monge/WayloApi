const { db } = require('../../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_DAYS || 30);

// POST /api/waylo/admin/login
async function loginAdmin(req, res) {
  try {
    const { email, contrasena } = req.body;
    if (!email || !contrasena) return res.status(400).json({ success: false, message: 'email y contrasena requeridos' });

    const q = await db.query(`SELECT u.id_usuario, u.nombre, u.email, u.contrasena, r.nombre as rol
                              FROM usuario u JOIN rol r ON u.id_rol = r.id_rol
                              WHERE LOWER(u.email)=LOWER($1) AND u.estado='A'`, [email]);
    if (q.rows.length === 0) return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    const user = q.rows[0];
    if ((user.rol || '').toLowerCase() !== 'admin') return res.status(403).json({ success: false, message: 'Acceso restringido: no es administrador' });

    const ok = await bcrypt.compare(contrasena, user.contrasena);
    if (!ok) return res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    // Generar JWT
    const payload = { id_usuario: user.id_usuario, nombre: user.nombre, email: user.email, rol: user.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

    // Refresh token simple UUID stored in token_sesion
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO token_sesion (id_usuario, token, refresh_token, expires_at, revoked) VALUES ($1,$2,$3,$4,$5)', [user.id_usuario, token, refreshToken, expiresAt, 'N']);

    // Remove sensitive fields
    delete user.contrasena;

    res.json({ success: true, data: { token, refreshToken, usuario: user, expiresIn: ACCESS_TOKEN_EXPIRES_IN } });
  } catch (err) {
    console.error('[admin][auth] login error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/admin/refresh
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'refreshToken requerido' });
    const q = await db.query('SELECT * FROM token_sesion WHERE refresh_token=$1 AND revoked=$2 LIMIT 1', [refreshToken, 'N']);
    if (q.rows.length === 0) return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    const session = q.rows[0];
    if (new Date(session.expires_at) < new Date()) return res.status(401).json({ success: false, message: 'Refresh token expirado' });

    const userQ = await db.query('SELECT u.id_usuario, u.nombre, u.email, r.nombre as rol FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario=$1', [session.id_usuario]);
    if (userQ.rows.length === 0) return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    const user = userQ.rows[0];
    const payload = { id_usuario: user.id_usuario, nombre: user.nombre, email: user.email, rol: user.rol };
    const newToken = jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

    // update token in token_sesion
    await db.query('UPDATE token_sesion SET token=$1, updated_at=NOW() WHERE id_token_sesion=$2', [newToken, session.id_token_sesion]);

    res.json({ success: true, data: { token: newToken, expiresIn: ACCESS_TOKEN_EXPIRES_IN } });
  } catch (err) {
    console.error('[admin][auth] refresh error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/admin/logout
async function logoutAdmin(req, res) {
  try {
    // prefer token from Authorization header
    const auth = req.headers.authorization;
    let token = null;
    if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1];
    // fallback to body (token or refreshToken)
    if (!token) token = req.body && (req.body.token || req.body.refreshToken);
    if (!token) return res.status(400).json({ success: false, message: 'token o refreshToken requerido' });

    await db.query("UPDATE token_sesion SET revoked='S', updated_at=NOW() WHERE token=$1 OR refresh_token=$1", [token]);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin][auth] logout error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { loginAdmin, refreshToken, logoutAdmin };

