const { db } = require('../../../config/db');

// GET /api/waylo/admin/transacciones
async function listTransacciones(req, res) {
  try {
    const { estado_transaccion, q, page = 1, pageSize = 50 } = req.query;
    const params = [];
    const where = [];
    let idx = 1;
    if (estado_transaccion) { where.push(`t.estado_transaccion=$${idx++}`); params.push(estado_transaccion); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(u.email) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }
    const offset = (Number(page)-1)*Number(pageSize);
    const sql = `SELECT t.*, r.id_reserva, r.monto_total, pg.id_perfil_guia, gu.nombre as guia_nombre, pc.id_perfil_cliente, cl.nombre as cliente_nombre
                 FROM transaccion t
                 JOIN reservas r ON r.id_reserva = t.id_reserva
                 JOIN perfil_guia pg ON pg.id_perfil_guia = r.id_perfil_guia
                 JOIN usuario gu ON gu.id_usuario = pg.id_usuario
                 JOIN perfil_cliente pc ON pc.id_perfil_cliente = r.id_perfil_cliente
                 JOIN usuario cl ON cl.id_usuario = pc.id_usuario
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY t.created_at DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;
    const qres = await db.query(sql, params);
    res.json({ success: true, data: qres.rows });
  } catch (err) {
    console.error('[admin][transacciones] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/transacciones/:id_transaccion/estado
async function setTransaccionEstado(req, res) {
  try {
    const { id_transaccion } = req.params;
    const { estado_transaccion } = req.body;
    if (!estado_transaccion) return res.status(400).json({ success: false, message: 'estado_transaccion requerido' });
    const up = await db.query('UPDATE transaccion SET estado_transaccion=$1, updated_at=NOW() WHERE id_transaccion=$2 RETURNING *', [estado_transaccion, id_transaccion]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][transacciones] setEstado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listTransacciones, setTransaccionEstado };
