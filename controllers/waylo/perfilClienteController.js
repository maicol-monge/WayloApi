const { db } = require('../../config/db');
const { obtenerUrlPublica } = require('../../services/imageService');

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

module.exports = { obtenerCliente, obtenerClientePorUsuario, actualizarCliente };
