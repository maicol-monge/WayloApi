const { db } = require('../../config/db');

// POST /api/waylo/favoritos
async function agregar(req, res) {
  try {
    const { id_perfil_guia, id_perfil_cliente } = req.body;
    if (!id_perfil_guia || !id_perfil_cliente) return res.status(400).json({ success: false, message: 'id_perfil_guia e id_perfil_cliente requeridos' });
    const ins = await db.query('INSERT INTO favorito (id_perfil_guia, id_perfil_cliente) VALUES ($1,$2) ON CONFLICT (id_perfil_guia, id_perfil_cliente) DO NOTHING RETURNING *', [id_perfil_guia, id_perfil_cliente]);
    res.status(201).json({ success: true, data: ins.rows[0] || null });
  } catch (err) {
    console.error('[waylo][favorito] agregar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/favoritos
async function eliminar(req, res) {
  try {
    const { id_perfil_guia, id_perfil_cliente } = req.body;
    await db.query('DELETE FROM favorito WHERE id_perfil_guia=$1 AND id_perfil_cliente=$2', [id_perfil_guia, id_perfil_cliente]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][favorito] eliminar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/favoritos/cliente/:id_perfil_cliente
async function listarPorCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    const q = await db.query(`
      SELECT f.*, pg.ciudad, u.nombre as nombre_guia, pg.imagen_perfil
      FROM favorito f
      JOIN perfil_guia pg ON pg.id_perfil_guia = f.id_perfil_guia
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      WHERE f.id_perfil_cliente = $1`, [id_perfil_cliente]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][favorito] listar cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { agregar, eliminar, listarPorCliente };
