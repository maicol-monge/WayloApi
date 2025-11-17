const { db } = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { subirImagen, obtenerUrlPublica } = require('../../services/imageService');
const { sendPasswordResetEmail } = require('../../services/emailService');

// simple in-memory login attempt tracking (email+ip)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCK_MS = 15 * 60 * 1000; // lock for 15 minutes

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}

function recordLoginAttempt(email, ip, success) {
  const key = `${email}|${ip}`;
  const now = Date.now();
  let rec = loginAttempts.get(key);
  if (!rec) {
    rec = { count: 0, first: now, lockedUntil: 0 };
  }
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  // failed
  if (now - rec.first > WINDOW_MS) {
    rec = { count: 1, first: now, lockedUntil: 0 };
  } else {
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = now + LOCK_MS;
    }
  }
  loginAttempts.set(key, rec);
}

function isLocked(email, ip) {
  const key = `${email}|${ip}`;
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return true;
  return false;
}

function signTokens(user) {
  const secret = process.env.JWT_SECRET || 'changeme';
  const payload = { id_usuario: user.id_usuario, email: user.email, rol: user.rol };
  const token = jwt.sign(payload, secret, { expiresIn: '8h' });
  const refresh = jwt.sign({ ...payload, type: 'refresh' }, secret, { expiresIn: '7d' });
  return { token, refresh };
}

// helper: subir opcionalmente foto de perfil a Supabase (carpeta 'foto-perfil')
async function maybeUploadProfile(file) {
  try {
    if (!file) return null;
    const lower = (file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) {
      // si no es imagen válida, ignorar subida (opcionalmente podríamos devolver 400)
      return null;
    }
    const result = await subirImagen(file.buffer, file.originalname, 'foto-perfil');
    if (!result.success) return null;
    return result.data.path; // path interno del bucket
  } catch (e) {
    return null;
  }
}

async function getRolId(nombre) {
  const name = nombre.toLowerCase();
  const existing = await db.query('SELECT id_rol FROM rol WHERE LOWER(nombre)=LOWER($1) LIMIT 1', [name]);
  if (existing.rows.length > 0) return existing.rows[0].id_rol;
  const inserted = await db.query('INSERT INTO rol (nombre, descripcion) VALUES ($1,$2) RETURNING id_rol', [name, `Rol auto-creado para ${name}`]);
  return inserted.rows[0].id_rol;
}

// POST /api/waylo/auth/registro/cliente
async function registrarCliente(req, res) {
  try {
    let { nombre, email, contrasena, descripcion, pais, ciudad } = req.body;
    // normalizar entradas
    if (typeof email === 'string') email = email.trim().toLowerCase();
    if (typeof nombre === 'string') nombre = nombre.trim();
  if (typeof contrasena === 'string') contrasena = contrasena.trim();
    if (typeof descripcion === 'string') descripcion = descripcion.trim();
    if (typeof pais === 'string') pais = pais.trim();
    if (typeof ciudad === 'string') ciudad = ciudad.trim();
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ success: false, message: 'nombre, email y contrasena son requeridos' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email inválido' });
    }
    if (!isStrongPassword(contrasena)) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const exists = await db.query('SELECT 1 FROM usuario WHERE email=$1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email ya registrado' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const idRol = await getRolId('cliente');
    const userIns = await db.query(
      `INSERT INTO usuario (nombre, email, contrasena, id_rol) VALUES ($1,$2,$3,$4) RETURNING id_usuario, nombre, email, id_rol, created_at`,
      [nombre, email, hash, idRol]
    );

    // Subir imagen_perfil opcional (modo tolerante: si falla, continúa sin imagen)
    let imagenPerfilPath = null;
    if (req.file) {
      try {
        const { validarImagen } = require('../../services/imageService');
        const validacion = validarImagen(req.file.originalname, req.file.size);
        if (validacion.valid) {
          imagenPerfilPath = await maybeUploadProfile(req.file);
        } else {
          console.warn('[waylo][auth] registrarCliente imagen inválida:', validacion.error);
        }
      } catch (e) {
        console.warn('[waylo][auth] registrarCliente error subiendo imagen (continuamos sin imagen):', e.message);
      }
    }

    // crear perfil_cliente con campos completos
    const perfil = await db.query(
      `INSERT INTO perfil_cliente (id_usuario, descripcion, pais, ciudad, imagen_perfil)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [userIns.rows[0].id_usuario, descripcion || null, pais || null, ciudad || null, imagenPerfilPath]
    );

    let imagen_perfil_url = null;
    if (perfil.rows[0].imagen_perfil) {
      const signed = await obtenerUrlPublica(perfil.rows[0].imagen_perfil, 3600);
      if (signed.success) imagen_perfil_url = signed.signedUrl;
    }

    return res.status(201).json({ success: true, data: { usuario: userIns.rows[0], perfil: { ...perfil.rows[0], imagen_perfil_url } } });
  } catch (err) {
    console.error('[waylo][auth] registrarCliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/registro/guia
async function registrarGuia(req, res) {
  try {
    let { nombre, email, contrasena, descripcion, idiomas = [], ciudad, pais, anios_experiencia, precio_hora, precio_dia_personalizado } = req.body;
    // permitir que 'idiomas' llegue como JSON string desde multipart
    if (typeof idiomas === 'string') {
      try { idiomas = JSON.parse(idiomas) } catch (e) { idiomas = [] }
    }
    // normalizar entradas
    if (typeof email === 'string') email = email.trim().toLowerCase();
    if (typeof nombre === 'string') nombre = nombre.trim();
  if (typeof contrasena === 'string') contrasena = contrasena.trim();
    if (typeof descripcion === 'string') descripcion = descripcion.trim();
    if (typeof pais === 'string') pais = pais.trim();
    if (typeof ciudad === 'string') ciudad = ciudad.trim();
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ success: false, message: 'nombre, email y contrasena son requeridos' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email inválido' });
    }
    if (!isStrongPassword(contrasena)) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const exists = await db.query('SELECT 1 FROM usuario WHERE email=$1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email ya registrado' });
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const idRol = await getRolId('guia');
    const userIns = await db.query(
      `INSERT INTO usuario (nombre, email, contrasena, id_rol) VALUES ($1,$2,$3,$4) RETURNING id_usuario, nombre, email, id_rol, created_at`,
      [nombre, email, hash, idRol]
    );

    let imagenPerfilPath = null;
    if (req.file) {
      try {
        const { validarImagen } = require('../../services/imageService');
        const validacion = validarImagen(req.file.originalname, req.file.size);
        if (validacion.valid) {
          imagenPerfilPath = await maybeUploadProfile(req.file);
        } else {
          console.warn('[waylo][auth] registrarGuia imagen inválida:', validacion.error);
        }
      } catch (e) {
        console.warn('[waylo][auth] registrarGuia error subiendo imagen (continuamos sin imagen):', e.message);
      }
    }

    const perfilIns = await db.query(
      `INSERT INTO perfil_guia (id_usuario, descripcion, pais, ciudad, imagen_perfil, anios_experiencia, precio_hora, precio_dia_personalizado) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        userIns.rows[0].id_usuario,
        descripcion || null,
        pais || null,
        ciudad || null,
        imagenPerfilPath || null,
        anios_experiencia || null,
        precio_hora || null,
        precio_dia_personalizado || null
      ]
    );

    // agregar idiomas si vienen
    if (Array.isArray(idiomas)) {
      for (const it of idiomas) {
        if (!it || !it.nombre) continue;
        const nivel = it.nivel || 'intermedio';
        await db.query(`INSERT INTO idiomas (id_usuario, nombre, nivel) VALUES ($1,$2,$3)`, [userIns.rows[0].id_usuario, it.nombre, nivel]);
      }
    }

    let imagen_perfil_url = null;
    if (perfilIns.rows[0].imagen_perfil) {
      const signed = await obtenerUrlPublica(perfilIns.rows[0].imagen_perfil, 3600);
      if (signed.success) imagen_perfil_url = signed.signedUrl;
    }

    return res.status(201).json({ success: true, data: { usuario: userIns.rows[0], perfil: { ...perfilIns.rows[0], imagen_perfil_url } } });
  } catch (err) {
    console.error('[waylo][auth] registrarGuia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/login
async function login(req, res) {
  try {
    let { email, contrasena } = req.body;
    if (typeof email === 'string') email = email.trim().toLowerCase();
    if (typeof contrasena === 'string') contrasena = contrasena.trim();
    if (!email || !contrasena) return res.status(400).json({ success: false, message: 'email y contrasena son requeridos' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (isLocked(email, ip)) return res.status(429).json({ success: false, message: 'Demasiados intentos fallidos. Intenta más tarde.' });

  const q = await db.query(`SELECT u.id_usuario, u.nombre, u.email, u.contrasena, u.id_rol, u.estado, u.created_at, u.updated_at, r.nombre as rol
                FROM usuario u JOIN rol r ON u.id_rol = r.id_rol
                WHERE u.email=$1`, [email]);
    if (q.rows.length === 0) {
      recordLoginAttempt(email, ip, false);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const ok = await bcrypt.compare(contrasena, q.rows[0].contrasena);
    if (!ok) {
      recordLoginAttempt(email, ip, false);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = q.rows[0];

    if (user.estado !== 'A') {
      recordLoginAttempt(email, ip, false);
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada. Por favor contacta con el administrador.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    if (user.rol && user.rol.toLowerCase() === 'guia') {
      const perfilGuia = await db.query('SELECT verificacion_estado FROM perfil_guia WHERE id_usuario=$1 LIMIT 1', [user.id_usuario]);
      if (perfilGuia.rows.length > 0) {
        const verificacionEstado = perfilGuia.rows[0].verificacion_estado;
        if (verificacionEstado === 'rechazado') {
          recordLoginAttempt(email, ip, false);
          return res.status(403).json({
            success: false,
            message: 'Tu verificación como guía ha sido rechazada. Por favor contacta con el administrador.',
            code: 'VERIFICATION_REJECTED'
          });
        }
      }
    }

    delete user.contrasena;
    const { token, refresh } = signTokens(user);
    const exp = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.query('INSERT INTO token_sesion (id_usuario, token, refresh_token, expires_at) VALUES ($1,$2,$3,$4)', [user.id_usuario, token, refresh, exp]);
    recordLoginAttempt(email, ip, true);

    let perfil = null;
    if (user.rol && user.rol.toLowerCase() === 'guia') {
      const pg = await db.query('SELECT * FROM perfil_guia WHERE id_usuario=$1 LIMIT 1', [user.id_usuario]);
      if (pg.rows.length) perfil = { tipo: 'guia', ...pg.rows[0] };
    } else {
      const pc = await db.query('SELECT * FROM perfil_cliente WHERE id_usuario=$1 LIMIT 1', [user.id_usuario]);
      if (pc.rows.length) perfil = { tipo: 'cliente', ...pc.rows[0] };
    }
    if (perfil && perfil.imagen_perfil) {
      const signed = await obtenerUrlPublica(perfil.imagen_perfil, 3600);
      if (signed.success) perfil.imagen_perfil_url = signed.signedUrl;
    }
    return res.json({ success: true, data: user, perfil, token, refreshToken: refresh, expiresAt: exp.toISOString() });
  } catch (err) {
    console.error('[waylo][auth] login error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/refresh
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'refreshToken requerido' });
    const secret = process.env.JWT_SECRET || 'changeme';
    let payload;
    try {
      payload = jwt.verify(refreshToken, secret);
      if (payload.type !== 'refresh') throw new Error('Tipo inválido');
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Refresh inválido o expirado' });
    }
    // verify exists in DB and not revoked
    const q = await db.query('SELECT * FROM token_sesion WHERE refresh_token=$1 AND revoked=$2 LIMIT 1', [refreshToken, 'N']);
    if (q.rows.length === 0) return res.status(401).json({ success: false, message: 'Refresh inválido' });

    const userQ = await db.query('SELECT u.id_usuario, u.email, r.nombre as rol FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1', [q.rows[0].id_usuario]);
    const user = userQ.rows[0];
    const { token } = signTokens(user);
    const exp = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.query('UPDATE token_sesion SET token=$1, expires_at=$2 WHERE id_token_sesion=$3', [token, exp, q.rows[0].id_token_sesion]);
    res.json({ success: true, token, expiresAt: exp.toISOString() });
  } catch (err) {
    console.error('[waylo][auth] refresh error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/logout
async function logout(req, res) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(400).json({ success: false, message: 'Token requerido' });
    const token = auth.split(' ')[1];
    await db.query("UPDATE token_sesion SET revoked='S' WHERE token=$1", [token]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][auth] logout error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/deactivate (self-service): desactiva la cuenta del usuario autenticado
async function deactivateAccount(req, res) {
  try {
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    const id = req.user.id_usuario;
    // Desactivar usuario
    const up = await db.query("UPDATE usuario SET estado='I', updated_at=NOW() WHERE id_usuario=$1 RETURNING id_usuario, email, estado", [id]);
    if (up.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    // Revocar todas las sesiones del usuario
    await db.query("UPDATE token_sesion SET revoked='S' WHERE id_usuario=$1", [id]);
    return res.json({ success: true, message: 'Cuenta desactivada exitosamente' });
  } catch (err) {
    console.error('[waylo][auth] deactivate error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/auth/email
async function updateEmail(req, res) {
  try {
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    let { newEmail } = req.body;
    if (typeof newEmail === 'string') newEmail = newEmail.trim().toLowerCase();
    if (!newEmail) {
      return res.status(400).json({ success: false, message: 'newEmail requerido' });
    }
    if (!isValidEmail(newEmail)) {
      return res.status(400).json({ success: false, message: 'Email inválido' });
    }
    // verificar duplicado
    const exists = await db.query('SELECT 1 FROM usuario WHERE email=$1 AND id_usuario<>$2', [newEmail, req.user.id_usuario]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email ya registrado' });
    }
  const up = await db.query('UPDATE usuario SET email=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING id_usuario, nombre, email', [newEmail, req.user.id_usuario]);
    if (up.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    return res.json({ success: true, data: up.rows[0], message: 'Email actualizado' });
  } catch (err) {
    console.error('[waylo][auth] updateEmail error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/password/change (autenticado)
async function changePassword(req, res) {
  try {
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    let { currentPassword, newPassword } = req.body;
    if (typeof currentPassword === 'string') currentPassword = currentPassword.trim();
    if (typeof newPassword === 'string') newPassword = newPassword.trim();
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword y newPassword son requeridos' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }
  const q = await db.query('SELECT contrasena FROM usuario WHERE id_usuario=$1 LIMIT 1', [req.user.id_usuario]);
    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const ok = await bcrypt.compare(currentPassword, q.rows[0].contrasena);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE usuario SET contrasena=$1, updated_at=NOW() WHERE id_usuario=$2', [hash, req.user.id_usuario]);
    return res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    console.error('[waylo][auth] changePassword error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { registrarCliente, registrarGuia, login, refreshToken, logout, deactivateAccount, updateEmail, changePassword };
