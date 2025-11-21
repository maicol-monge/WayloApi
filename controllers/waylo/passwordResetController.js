const crypto = require('crypto');
const { db } = require('../../config/db');
const { sendPasswordResetEmail } = require('../../services/emailService');

// POST /api/waylo/auth/password/forgot
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'email requerido' });
    const q = await db.query('SELECT id_usuario, nombre FROM usuario WHERE email=$1 AND estado=$2', [email, 'A']);
    if (q.rows.length === 0) {
      // por seguridad, responder 200 siempre
      return res.json({ success: true });
    }
    const user = q.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const exp = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await db.query('INSERT INTO token_reset (id_usuario, token, expires_at) VALUES ($1,$2,$3)', [user.id_usuario, token, exp]);

    const base = (process.env.FRONTEND_BASE_URL || 'https://waylopasswordreset.onrender.com').replace(/\/+$/, '');
    const link = `${base}/reset-password?token=${token}`;
    console.log('[password-reset] Generated reset link:', link);
    
    try {
      await sendPasswordResetEmail({ to: email, link, tipo: 'Waylo', displayName: user.nombre });
      console.log('[password-reset] Email sent successfully to:', email);
    } catch (e) {
      console.error('[password-reset] Failed to send email:', e.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][auth] forgotPassword error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/password/reset
async function resetPassword(req, res) {
  try {
    const { token, contrasena } = req.body;
    if (!token || !contrasena) return res.status(400).json({ success: false, message: 'token y contrasena requeridos' });
    const q = await db.query("SELECT * FROM token_reset WHERE token=$1 AND usado='N' LIMIT 1", [token]);
    if (q.rows.length === 0) return res.status(400).json({ success: false, message: 'Token inválido' });
    const row = q.rows[0];
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Token expirado' });
    }

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(contrasena, 10);
    await db.query('UPDATE usuario SET contrasena=$1, updated_at=NOW() WHERE id_usuario=$2', [hash, row.id_usuario]);
    await db.query("UPDATE token_reset SET usado='S' WHERE id_token_reset=$1", [row.id_token_reset]);

    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][auth] resetPassword error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { forgotPassword, resetPassword };
