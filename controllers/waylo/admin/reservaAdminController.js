const { db } = require('../../../config/db');

// GET /api/waylo/admin/reservas
async function listReservas(req, res) {
  try {
    const { estado_reserva, estado_pago, q, page = 1, pageSize = 50 } = req.query;
    const params = [];
    const where = [];
    let idx = 1;
    if (estado_reserva) { where.push(`r.estado_reserva=$${idx++}`); params.push(estado_reserva); }
    if (estado_pago) { where.push(`r.estado_pago=$${idx++}`); params.push(estado_pago); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(pg.ciudad) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }
    const offset = (Number(page)-1)*Number(pageSize);
    const sql = `SELECT r.*, u.nombre as cliente_nombre, pg.id_perfil_guia, gu.nombre as guia_nombre
                 FROM reservas r
                 JOIN perfil_cliente pc ON pc.id_perfil_cliente = r.id_perfil_cliente
                 JOIN usuario u ON u.id_usuario = pc.id_usuario
                 JOIN perfil_guia pg ON pg.id_perfil_guia = r.id_perfil_guia
                 JOIN usuario gu ON gu.id_usuario = pg.id_usuario
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY r.created_at DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;
    const qres = await db.query(sql, params);
    res.json({ success: true, data: qres.rows });
  } catch (err) {
    console.error('[admin][reservas] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/reservas/:id_reserva/estado
async function setReservaEstado(req, res) {
  try {
    const { id_reserva } = req.params;
    const { estado_reserva, estado_pago } = req.body;
    if (!estado_reserva && !estado_pago) return res.status(400).json({ success: false, message: 'estado_reserva o estado_pago requerido' });
    const fields = [];
    const params = [];
    let idx = 1;
    if (estado_reserva) { fields.push(`estado_reserva=$${idx++}`); params.push(estado_reserva); }
    if (estado_pago) { fields.push(`estado_pago=$${idx++}`); params.push(estado_pago); }
    params.push(id_reserva);
    const up = await db.query(`UPDATE reservas SET ${fields.join(', ')}, updated_at=NOW() WHERE id_reserva=$${idx} RETURNING *`, params);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][reservas] setEstado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/admin/reservas/:id_reserva
async function deleteReserva(req, res) {
  try {
    const { id_reserva } = req.params;
    await db.query("UPDATE reservas SET estado='I' WHERE id_reserva=$1", [id_reserva]);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin][reservas] delete error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listReservas, setReservaEstado, deleteReserva };
