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
// Devuelve favoritos enriquecidos: rating promedio, total reseñas, precio_hora, idiomas, imagen firmada.
async function listarPorCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    if (!id_perfil_cliente) return res.status(400).json({ success: false, message: 'id_perfil_cliente requerido' });
    const sql = `
      WITH resenas AS (
        SELECT id_perfil_guia, AVG(calificacion) AS avg_r, COUNT(*) AS cnt
        FROM resena WHERE estado='A' GROUP BY id_perfil_guia
      )
      SELECT f.id_favorito, f.id_perfil_guia, f.id_perfil_cliente, f.created_at,
             pg.ciudad, pg.pais, pg.descripcion, pg.imagen_perfil, pg.precio_hora,
             u.nombre AS nombre_guia,
             COALESCE(r.avg_r,0) AS rating_promedio,
             COALESCE(r.cnt,0) AS total_resenas,
             (
               SELECT array_remove(array_agg(DISTINCT i.nombre), NULL)
               FROM idiomas i WHERE i.id_usuario = pg.id_usuario
             ) AS idiomas,
             TRUE AS is_favorite
      FROM favorito f
      JOIN perfil_guia pg ON pg.id_perfil_guia = f.id_perfil_guia
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      LEFT JOIN resenas r ON r.id_perfil_guia = f.id_perfil_guia
      WHERE f.id_perfil_cliente = $1
      ORDER BY f.created_at DESC
      LIMIT 300`;
    const q = await db.query(sql, [id_perfil_cliente]);
    // firmar imágenes de perfil
    const { obtenerUrlPublica } = require('../../services/imageService');
    const rows = await Promise.all(q.rows.map(async (row) => {
      if (row.imagen_perfil) {
        try {
          const signed = await obtenerUrlPublica(row.imagen_perfil, 3600);
          if (signed.success) row.imagen_perfil_url = signed.signedUrl;
        } catch (e) {}
      }
      return row;
    }));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[waylo][favorito] listar cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { agregar, eliminar, listarPorCliente };
