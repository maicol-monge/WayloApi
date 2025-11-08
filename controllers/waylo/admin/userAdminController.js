const { db } = require('../../../config/db');
const bcrypt = require('bcryptjs');
const { obtenerUrlPublica } = require('../../../services/imageService');

// GET /api/waylo/admin/users
async function listUsers(req, res) {
  try {
    const { role, estado, q, page = 1, pageSize = 50 } = req.query;
    const params = [];
    let where = [];
    let idx = 1;
    if (role) { where.push(`LOWER(r.nombre)=LOWER($${idx++})`); params.push(role); }
    if (estado) { where.push(`u.estado=$${idx++}`); params.push(estado); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(u.email) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }

    const offset = (Number(page) -1) * Number(pageSize);
    const sql = `SELECT u.id_usuario, u.nombre, u.email, u.estado, u.created_at, u.updated_at, r.nombre as rol,
                 pg.imagen_perfil as imagen_perfil_guia,
                 pc.imagen_perfil as imagen_perfil_cliente
                 FROM usuario u 
                 JOIN rol r ON r.id_rol = u.id_rol
                 LEFT JOIN perfil_guia pg ON pg.id_usuario = u.id_usuario
                 LEFT JOIN perfil_cliente pc ON pc.id_usuario = u.id_usuario
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY u.created_at DESC
                 LIMIT ${Number(pageSize)} OFFSET ${offset}`;
    
    const qres = await db.query(sql, params);
    
    // Firmar URLs de imágenes de perfil
    const rows = await Promise.all(qres.rows.map(async (row) => {
      const imagenPerfil = row.imagen_perfil_guia || row.imagen_perfil_cliente;
      if (imagenPerfil) {
        try {
          const signed = await obtenerUrlPublica(imagenPerfil, 3600);
          if (signed.success) row.imagen_perfil_url = signed.signedUrl;
        } catch (e) {
          console.error('Error signing image URL:', e);
        }
      }
      // Limpiar campos temporales
      delete row.imagen_perfil_guia;
      delete row.imagen_perfil_cliente;
      return row;
    }));
    
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[admin][users] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: err.message });
  }
}

// GET /api/waylo/admin/users/:id
async function getUser(req, res) {
  try {
    const { id } = req.params;
    
    const q = await db.query('SELECT u.*, r.nombre as rol FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario=$1', [id]);
    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    
    const user = q.rows[0];
    
    // try to fetch profiles
    const guia = await db.query('SELECT * FROM perfil_guia WHERE id_usuario=$1', [user.id_usuario]);
    const cliente = await db.query('SELECT * FROM perfil_cliente WHERE id_usuario=$1', [user.id_usuario]);
    
    // Obtener perfil con imagen
    let perfilGuia = guia.rows[0] || null;
    let perfilCliente = cliente.rows[0] || null;
    
    // Firmar URL de imagen de perfil de guía
    if (perfilGuia && perfilGuia.imagen_perfil) {
      try {
        const signed = await obtenerUrlPublica(perfilGuia.imagen_perfil, 3600);
        if (signed.success) perfilGuia.imagen_perfil_url = signed.signedUrl;
      } catch (e) {
        console.error('Error signing guia image URL:', e);
      }
    }
    
    // Firmar URL de imagen de perfil de cliente
    if (perfilCliente && perfilCliente.imagen_perfil) {
      try {
        const signed = await obtenerUrlPublica(perfilCliente.imagen_perfil, 3600);
        if (signed.success) perfilCliente.imagen_perfil_url = signed.signedUrl;
      } catch (e) {
        console.error('Error signing cliente image URL:', e);
      }
    }
    
    // Añadir imagen_perfil_url al usuario para facilitar el acceso
    const imagenPerfil = perfilGuia?.imagen_perfil || perfilCliente?.imagen_perfil;
    if (imagenPerfil) {
      try {
        const signed = await obtenerUrlPublica(imagenPerfil, 3600);
        if (signed.success) {
          user.imagen_perfil_url = signed.signedUrl;
        }
      } catch (e) {
        console.error('Error signing user image URL:', e);
      }
    }
    
    res.json({ 
      success: true, 
      data: { 
        usuario: user,
        perfil_guia: perfilGuia, 
        perfil_cliente: perfilCliente,
        // También incluir directamente para compatibilidad
        guia: perfilGuia,
        cliente: perfilCliente
      } 
    });
  } catch (err) {
    console.error('[admin][users] get error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: err.message });
  }
}

// PUT /api/waylo/admin/users/:id/role
async function setRole(req, res) {
  try {
    const { id } = req.params;
    const { id_rol } = req.body;
    if (!id_rol) return res.status(400).json({ success: false, message: 'id_rol requerido' });
    const up = await db.query('UPDATE usuario SET id_rol=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING *', [id_rol, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setRole error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/users/:id/state
async function setState(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'A' or 'I'
    if (!estado) return res.status(400).json({ success: false, message: 'estado requerido' });
    const up = await db.query('UPDATE usuario SET estado=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING *', [estado, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setState error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/users/:id/password
async function setPassword(req, res) {
  try {
    const { id } = req.params;
    const { contrasena } = req.body;
    if (!contrasena) return res.status(400).json({ success: false, message: 'contrasena requerida' });
    const hash = await bcrypt.hash(contrasena, 10);
    const up = await db.query('UPDATE usuario SET contrasena=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING id_usuario, email, nombre', [hash, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setPassword error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listUsers, getUser, setRole, setState, setPassword };
