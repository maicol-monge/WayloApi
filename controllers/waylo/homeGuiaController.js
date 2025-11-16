const { db } = require('../../config/db');

// GET /api/waylo/home/guia/:id_perfil_guia
// Devuelve agenda del día (reservas de hoy), métricas toursToday, averageRating y recentReview.
async function homeGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    if (!id_perfil_guia) {
      return res.status(400).json({ success: false, message: 'id_perfil_guia requerido' });
    }

    // Reservas del día (hora_inicio dentro de la fecha actual)
    const reservasQuery = await db.query(
      `SELECT * FROM reservas 
       WHERE id_perfil_guia=$1 
         AND DATE(hora_inicio) = CURRENT_DATE 
       ORDER BY hora_inicio ASC`,
      [id_perfil_guia]
    );
    const reservasHoy = reservasQuery.rows;

    // Total de tours hoy (excluye canceladas)
    const toursToday = reservasHoy.filter(r => (r.estado_reserva || '').toLowerCase() !== 'cancelada' && (r.estado_reserva || '').toLowerCase() !== 'cancelado').length;

    // Promedio de calificación del guía
    const avgQuery = await db.query(
      `SELECT AVG(calificacion)::numeric(10,2) AS avg_rating, COUNT(*) AS total_reviews 
       FROM resena WHERE id_perfil_guia=$1`,
      [id_perfil_guia]
    );
    const avgRating = avgQuery.rows[0]?.avg_rating || 0;
    const totalReviews = parseInt(avgQuery.rows[0]?.total_reviews || 0, 10);

    // Reseña más reciente
    const recentQuery = await db.query(
      `SELECT * FROM resena WHERE id_perfil_guia=$1 ORDER BY created_at DESC LIMIT 1`,
      [id_perfil_guia]
    );
    const recentReview = recentQuery.rows[0] || null;

    res.json({
      success: true,
      data: {
        agenda: reservasHoy,
        toursToday,
        averageRating: Number(avgRating),
        totalReviews,
        recentReview
      }
    });
  } catch (err) {
    console.error('[waylo][homeGuia] error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { homeGuia };