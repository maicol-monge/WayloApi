const { db } = require('../../config/db');
const bcrypt = require('bcryptjs');

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
    const { nombre, email, contrasena } = req.body;
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ success: false, message: 'nombre, email y contrasena son requeridos' });
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

    // crear perfil_cliente
    const perfil = await db.query(
      `INSERT INTO perfil_cliente (id_usuario) VALUES ($1) RETURNING id_perfil_cliente, imagen_perfil, pais, ciudad`,
      [userIns.rows[0].id_usuario]
    );

    return res.status(201).json({ success: true, data: { usuario: userIns.rows[0], perfil: perfil.rows[0] } });
  } catch (err) {
    console.error('[waylo][auth] registrarCliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/registro/guia
async function registrarGuia(req, res) {
  try {
    const { nombre, email, contrasena, descripcion, idiomas = [], ciudad, pais, anios_experiencia, precio_hora, precio_dia_personalizado } = req.body;
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ success: false, message: 'nombre, email y contrasena son requeridos' });
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

    const perfilIns = await db.query(
      `INSERT INTO perfil_guia (id_usuario, descripcion, pais, ciudad, anios_experiencia, precio_hora, precio_dia_personalizado) 
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id_perfil_guia, verificacion_estado`,
      [userIns.rows[0].id_usuario, descripcion || null, pais || null, ciudad || null, anios_experiencia || null, precio_hora || null, precio_dia_personalizado || null]
    );

    // agregar idiomas si vienen
    if (Array.isArray(idiomas)) {
      for (const it of idiomas) {
        if (!it || !it.nombre) continue;
        const nivel = it.nivel || 'intermedio';
        await db.query(`INSERT INTO idiomas (id_usuario, nombre, nivel) VALUES ($1,$2,$3)`, [userIns.rows[0].id_usuario, it.nombre, nivel]);
      }
    }

    return res.status(201).json({ success: true, data: { usuario: userIns.rows[0], perfil: perfilIns.rows[0] } });
  } catch (err) {
    console.error('[waylo][auth] registrarGuia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/auth/login
async function login(req, res) {
  try {
    const { email, contrasena } = req.body;
    if (!email || !contrasena) return res.status(400).json({ success: false, message: 'email y contrasena son requeridos' });

    const q = await db.query(`SELECT u.id_usuario, u.nombre, u.email, u.contrasena, r.nombre as rol
                              FROM usuario u JOIN rol r ON u.id_rol = r.id_rol
                              WHERE u.email=$1 AND u.estado='A'`, [email]);
    if (q.rows.length === 0) return res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(contrasena, q.rows[0].contrasena);
    if (!ok) return res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    const user = q.rows[0];
    delete user.contrasena;
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('[waylo][auth] login error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { registrarCliente, registrarGuia, login };
