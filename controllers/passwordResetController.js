const { db } = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../services/emailService");

// Utilidad para generar tokens seguros
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Crea/actualiza un token de restablecimiento para un usuario o tienda
// tipo: 'usuario' | 'tienda'
async function solicitarReset(req, res) {
  try {
    const { tipo, correo } = req.body;
    if (!tipo || !correo) {
      return res.status(400).json({ success: false, message: "tipo y correo son requeridos" });
    }
    const t = String(tipo).toLowerCase();
    if (t !== 'usuario' && t !== 'tienda') {
      return res.status(400).json({ success: false, message: "tipo inválido" });
    }

    const tabla = t === 'usuario' ? 'Usuarios' : 'Tienda';
    const idCampo = t === 'usuario' ? 'id_usuario' : 'id_tienda';

    const entity = await db.query(`SELECT ${idCampo}, correo FROM ${tabla} WHERE correo = $1 AND estado = 'A'`, [correo]);
    if (entity.rows.length === 0) {
      // Para evitar enumeración de emails, responder 200 genérico
      return res.json({ success: true, message: 'Si el correo existe, se enviará un enlace de restablecimiento.' });
    }

    const id = entity.rows[0][idCampo];
    const token = generateToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    // Upsert en tabla de tokens
    await db.query(`
      INSERT INTO PasswordResetTokens (tipo, id_referencia, token, expires_at, usado)
      VALUES ($1, $2, $3, $4, false)
      ON CONFLICT (token) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, usado = false
    `, [t, id, token, expires]);

    // Enviar correo con el enlace de restablecimiento
    const base = process.env.FRONTEND_BASE_URL || 'https://ecopointspasswordreset.onrender.com';
    const enlace = `${base.replace(/\/$/, '')}/reset?token=${encodeURIComponent(token)}&tipo=${encodeURIComponent(t)}`;

    // Enviar email en background para no bloquear la respuesta HTTP
    if (String(process.env.LOG_RESET_LINKS).toLowerCase() === 'true') {
      console.info('[password-reset] Link generado:', enlace);
    }

    setImmediate(async () => {
      try {
        await sendPasswordResetEmail({
          to: correo,
          link: enlace,
          tipo: t,
          displayName: t === 'usuario' ? 'usuario' : 'tienda'
        });
        console.log(`[password-reset] Enlace enviado a ${correo}: ${enlace}`);
      } catch (mailErr) {
        console.error('[password-reset] Error enviando correo de reset:', mailErr);
      }
    });

    // Responder inmediatamente
    return res.json({ success: true, message: 'Si el correo existe, se enviará un enlace de restablecimiento.' });
  } catch (error) {
    console.error('Error en solicitarReset:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// Verifica si un token es válido
// Verifica si un token es válido y devuelve displayName además de tipo/id
async function validarToken(req, res) {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: 'token requerido' });

    const q = await db.query(`
      SELECT tipo, id_referencia, expires_at, usado
      FROM PasswordResetTokens
      WHERE token = $1
    `, [token]);

    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Token no encontrado' });
    }

    const row = q.rows[0];
    if (row.usado) {
      return res.status(400).json({ success: false, message: 'Token ya fue utilizado' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Token expirado' });
    }

    // Obtener displayName según tipo
    let displayName = null;
    if (row.tipo === 'usuario') {
      const userQ = await db.query(
        `SELECT nombre, apellido, correo FROM Usuarios WHERE id_usuario = $1 AND estado = 'A'`,
        [row.id_referencia]
      );
      if (userQ.rows.length) {
        const u = userQ.rows[0];
        displayName = [u.nombre, u.apellido].filter(Boolean).join(' ') || u.correo;
      }
    } else if (row.tipo === 'tienda') {
      const shopQ = await db.query(
        `SELECT nombre, correo FROM Tienda WHERE id_tienda = $1 AND estado = 'A'`,
        [row.id_referencia]
      );
      if (shopQ.rows.length) {
        const s = shopQ.rows[0];
        displayName = s.nombre || s.correo;
      }
    }

    return res.json({
      success: true,
      data: { tipo: row.tipo, id_referencia: row.id_referencia, displayName }
    });
  } catch (error) {
    console.error('Error en validarToken:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// Confirma el restablecimiento usando el token y establece la nueva contraseña
async function confirmarReset(req, res) {
  const client = await db.connect();
  try {
    const { token } = req.params;
    const { password_nueva } = req.body;
    if (!token || !password_nueva) {
      return res.status(400).json({ success: false, message: 'token y password_nueva son requeridos' });
    }
    if (String(password_nueva).length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    await client.query('BEGIN');

    const q = await client.query(`
      SELECT * FROM PasswordResetTokens WHERE token = $1 FOR UPDATE
    `, [token]);

    if (q.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Token no encontrado' });
    }

    const row = q.rows[0];
    if (row.usado) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Token ya fue utilizado' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Token expirado' });
    }

    const hashed = await bcrypt.hash(password_nueva, 10);

    if (row.tipo === 'usuario') {
      await client.query(`UPDATE Usuarios SET password = $1 WHERE id_usuario = $2 AND estado = 'A'`, [hashed, row.id_referencia]);
    } else if (row.tipo === 'tienda') {
      await client.query(`UPDATE Tienda SET password = $1 WHERE id_tienda = $2 AND estado = 'A'`, [hashed, row.id_referencia]);
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Tipo de token inválido' });
    }

    await client.query(`UPDATE PasswordResetTokens SET usado = true WHERE token = $1`, [token]);
    await client.query('COMMIT');

    return res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en confirmarReset:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

module.exports = {
  solicitarReset,
  validarToken,
  confirmarReset,
};
