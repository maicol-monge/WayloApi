const { db } = require('../../config/db');
const { obtenerUrlPublica, subirImagen } = require('../../services/imageService');

// GET /api/waylo/clientes/:id
async function obtenerCliente(req, res) {
  try {
    const { id } = req.params;
  const q = await db.query(`SELECT pc.*, u.nombre, u.email FROM perfil_cliente pc JOIN usuario u ON u.id_usuario=pc.id_usuario WHERE pc.id_perfil_cliente=$1`, [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil cliente no encontrado' });
    const row = q.rows[0];
    if (row.imagen_perfil) {
      const signed = await obtenerUrlPublica(row.imagen_perfil, 3600);
      if (signed.success) row.imagen_perfil_url = signed.signedUrl;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[waylo][clientes] obtener error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/clientes/usuario/:id_usuario
async function obtenerClientePorUsuario(req, res) {
  try {
    const { id_usuario } = req.params;
  const q = await db.query(`SELECT pc.*, u.nombre, u.email FROM perfil_cliente pc JOIN usuario u ON u.id_usuario=pc.id_usuario WHERE pc.id_usuario=$1`, [id_usuario]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil cliente no encontrado' });
    const row = q.rows[0];
    if (row.imagen_perfil) {
      const signed = await obtenerUrlPublica(row.imagen_perfil, 3600);
      if (signed.success) row.imagen_perfil_url = signed.signedUrl;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[waylo][clientes] obtener por usuario error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/clientes/:id
async function actualizarCliente(req, res) {
  try {
    const { id } = req.params;
    const { descripcion, pais, ciudad } = req.body;

    const fields = [];
    const params = [];
    let idx = 1;

    if (descripcion !== undefined) { fields.push(`descripcion=$${idx++}`); params.push(descripcion); }
    if (pais !== undefined) { fields.push(`pais=$${idx++}`); params.push(pais); }
    if (ciudad !== undefined) { fields.push(`ciudad=$${idx++}`); params.push(ciudad); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    params.push(id);

  const up = await db.query(`UPDATE perfil_cliente SET ${fields.join(', ')} WHERE id_perfil_cliente=$${idx} RETURNING *`, params);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil cliente no encontrado' });

    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][clientes] actualizar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/clientes/:id/nombre  → actualiza usuario.nombre a partir del perfil_cliente
async function actualizarNombre(req, res) {
  try {
    const { id } = req.params; // id_perfil_cliente
    let { nombre } = req.body;
    if (typeof nombre === 'string') nombre = nombre.trim();
    if (!nombre) return res.status(400).json({ success: false, message: 'nombre requerido' });

    const q = await db.query('SELECT id_usuario FROM perfil_cliente WHERE id_perfil_cliente=$1 LIMIT 1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil cliente no encontrado' });
    const idUsuario = q.rows[0].id_usuario;
    const up = await db.query('UPDATE usuario SET nombre=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING id_usuario, nombre, email', [nombre, idUsuario]);
    return res.json({ success: true, data: up.rows[0], message: 'Nombre actualizado' });
  } catch (err) {
    console.error('[waylo][clientes] actualizarNombre error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/clientes/:id/avatar → sube imagen y actualiza perfil_cliente.imagen_perfil
async function actualizarAvatar(req, res) {
  try {
    const { id } = req.params; // id_perfil_cliente
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo de imagen requerido' });
    const lower = (req.file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) {
      return res.status(400).json({ success: false, message: 'Formato de imagen inválido' });
    }
    const upload = await subirImagen(req.file.buffer, req.file.originalname, 'foto-perfil');
    if (!upload.success) {
      return res.status(500).json({ success: false, message: 'No se pudo subir la imagen' });
    }
    const path = upload.data.path;
    const up = await db.query('UPDATE perfil_cliente SET imagen_perfil=$1 WHERE id_perfil_cliente=$2 RETURNING imagen_perfil', [path, id]);
    let imagen_perfil_url = null;
    if (up.rows.length) {
      const signed = await obtenerUrlPublica(up.rows[0].imagen_perfil, 3600);
      if (signed.success) imagen_perfil_url = signed.signedUrl;
    }
    res.json({ success: true, data: { imagen_perfil_url } });
  } catch (err) {
    console.error('[waylo][clientes] actualizarAvatar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { obtenerCliente, obtenerClientePorUsuario, actualizarCliente, actualizarNombre, actualizarAvatar };
