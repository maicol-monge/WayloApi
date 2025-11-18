const { db } = require('../../config/db');
const { obtenerUrlPublica } = require('../../services/imageService');

// GET /api/waylo/home/cliente/:id_perfil_cliente
// Devuelve listado de guías aprobado + actividad reciente (reservas y favoritos) para el cliente.
async function homeCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    if (!id_perfil_cliente) {
      return res.status(400).json({ success: false, message: 'id_perfil_cliente requerido' });
    }

    // validar perfil cliente
    const perfilQ = await db.query('SELECT id_perfil_cliente FROM perfil_cliente WHERE id_perfil_cliente=$1 AND estado=$2 LIMIT 1', [id_perfil_cliente, 'A']);
    if (!perfilQ.rows.length) return res.status(404).json({ success: false, message: 'Perfil cliente no encontrado' });

    // Query guías enriquecido con idiomas y favorito
    const guidesSql = `
      WITH resenas AS (
        SELECT id_perfil_guia, AVG(calificacion) AS avg_r, COUNT(*) AS cnt
        FROM resena WHERE estado='A' GROUP BY id_perfil_guia
      )
      SELECT pg.id_perfil_guia, pg.id_usuario, pg.descripcion, pg.pais, pg.ciudad, pg.imagen_perfil,
             pg.anios_experiencia, pg.precio_hora, pg.precio_dia_personalizado,
             u.nombre AS nombre_guia,
             COALESCE(r.avg_r,0) AS rating_promedio,
             COALESCE(r.cnt,0) AS total_resenas,
             (
               SELECT array_remove(array_agg(DISTINCT i.nombre), NULL)
               FROM idiomas i WHERE i.id_usuario = u.id_usuario
             ) AS idiomas,
             EXISTS(
               SELECT 1 FROM favorito f
               WHERE f.id_perfil_guia = pg.id_perfil_guia
                 AND f.id_perfil_cliente = $1
             ) AS is_favorite
      FROM perfil_guia pg
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      LEFT JOIN resenas r ON r.id_perfil_guia = pg.id_perfil_guia
      WHERE pg.estado='A' AND COALESCE(pg.verificacion_estado,'pendiente')='aprobado'
      ORDER BY rating_promedio DESC NULLS LAST, pg.precio_hora ASC NULLS LAST
      LIMIT 100`;
    const guidesQ = await db.query(guidesSql, [id_perfil_cliente]);
    const guides = await Promise.all(guidesQ.rows.map(async (row) => {
      if (row.imagen_perfil) {
        try {
          const signed = await obtenerUrlPublica(row.imagen_perfil, 3600);
          if (signed.success) row.imagen_perfil_url = signed.signedUrl;
        } catch (e) {}
      }
      return row;
    }));

    // Reservas recientes (últimas 10)
    const reservasSql = `
      SELECT r.id_reserva, r.id_perfil_guia, r.hora_inicio, r.hora_fin, r.estado_reserva,
             pg.ciudad, pg.pais, u.nombre AS nombre_guia, r.created_at
      FROM reservas r
      JOIN perfil_guia pg ON pg.id_perfil_guia = r.id_perfil_guia
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      WHERE r.id_perfil_cliente = $1 AND r.estado='A'
      ORDER BY r.created_at DESC
      LIMIT 10`;
    const reservasQ = await db.query(reservasSql, [id_perfil_cliente]);

    // Favoritos recientes (últimos 10)
    const favoritosSql = `
      SELECT f.id_favorito, f.id_perfil_guia, f.created_at, u.nombre AS nombre_guia, pg.ciudad, pg.pais
      FROM favorito f
      JOIN perfil_guia pg ON pg.id_perfil_guia = f.id_perfil_guia
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      WHERE f.id_perfil_cliente = $1 AND f.estado='A'
      ORDER BY f.created_at DESC
      LIMIT 10`;
    const favoritosQ = await db.query(favoritosSql, [id_perfil_cliente]);

    return res.json({ success: true, data: { guides, recent: { reservas: reservasQ.rows, favoritos: favoritosQ.rows } } });
  } catch (err) {
    console.error('[waylo][homeCliente] error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { homeCliente };
