const { db } = require('../../config/db');

// POST /api/waylo/reservas
async function crearReserva(req, res) {
  try {
    const { id_perfil_guia, id_perfil_cliente, lugar, personas, hora_inicio, hora_fin, monto } = req.body;
    if (!id_perfil_guia || !id_perfil_cliente || !hora_inicio || !hora_fin || !monto) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: id_perfil_guia, id_perfil_cliente, hora_inicio, hora_fin, monto' });
    }

    // comisiones: guia 15%, cliente 2.5% del monto base
    const comision = Number((Number(monto) * 0.15).toFixed(2));
    const comisionCliente = Number((Number(monto) * 0.025).toFixed(2));
    const monto_total = Number(Number(monto) + comision + comisionCliente).toFixed(2);

    const ins = await db.query(
      `INSERT INTO reservas (id_perfil_guia, id_perfil_cliente, lugar, personas, hora_inicio, hora_fin, monto, comision, monto_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id_perfil_guia, id_perfil_cliente, lugar || null, personas || null, hora_inicio, hora_fin, monto, comision, monto_total]
    );

    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][reservas] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/reservas/guia/:id_perfil_guia
async function reservasDeGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query('SELECT * FROM reservas WHERE id_perfil_guia=$1 ORDER BY created_at DESC', [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][reservas] listar guia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/reservas/cliente/:id_perfil_cliente
async function reservasDeCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    const q = await db.query('SELECT * FROM reservas WHERE id_perfil_cliente=$1 ORDER BY created_at DESC', [id_perfil_cliente]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][reservas] listar cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/reservas/:id_reserva/estado
async function actualizarEstado(req, res) {
  try {
    const { id_reserva } = req.params;
    const { estado_reserva } = req.body; // Confirmada, Completada, Pendiente, Cancelada
    if (!estado_reserva) return res.status(400).json({ success: false, message: 'estado_reserva requerido' });
    const up = await db.query('UPDATE reservas SET estado_reserva=$1, updated_at=NOW() WHERE id_reserva=$2 RETURNING *', [estado_reserva, id_reserva]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][reservas] actualizar estado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearReserva, reservasDeGuia, reservasDeCliente, actualizarEstado };
