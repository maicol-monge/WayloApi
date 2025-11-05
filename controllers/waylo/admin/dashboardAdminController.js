const { db } = require('../../../config/db');

// GET /api/waylo/admin/dashboard/summary
async function summary(req, res) {
  try {
    const users = await db.query('SELECT COUNT(*)::int as total FROM usuario');
    const guias = await db.query("SELECT COUNT(*)::int as total FROM perfil_guia WHERE estado='A'");
    const reservas = await db.query("SELECT estado_reserva, COUNT(*)::int as count FROM reservas GROUP BY estado_reserva");
    const trans = await db.query("SELECT estado_transaccion, COUNT(*)::int as count FROM transaccion GROUP BY estado_transaccion");
    res.json({ success: true, data: { total_users: users.rows[0].total, total_guias: guias.rows[0].total, reservas: reservas.rows, transacciones: trans.rows } });
  } catch (err) {
    console.error('[admin][dashboard] summary error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { summary };
