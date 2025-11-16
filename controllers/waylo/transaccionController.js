const { db } = require('../../config/db');

// POST /api/waylo/transacciones
async function crearTransaccion(req, res) {
  try {
    const { id_reserva, metodo_pago, monto_total, comision_guia, comision_cliente, estado_transaccion = 'pendiente' } = req.body;
    if (!id_reserva || !monto_total) return res.status(400).json({ success: false, message: 'id_reserva y monto_total requeridos' });

    const ins = await db.query(
      `INSERT INTO transaccion (id_reserva, metodo_pago, monto_total, comision_guia, comision_cliente, estado_transaccion)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id_reserva, metodo_pago || null, monto_total, comision_guia || null, comision_cliente || null, estado_transaccion]
    );

    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][transaccion] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearTransaccion };
// GET /api/waylo/transacciones/usuario/:id_usuario
async function listarPorUsuario(req, res) {
  try {
    const { id_usuario } = req.params;
    const q = await db.query(`
      SELECT t.*, r.id_perfil_guia, r.id_perfil_cliente
      FROM transaccion t
      JOIN reservas r ON r.id_reserva = t.id_reserva
      JOIN perfil_cliente pc ON pc.id_perfil_cliente = r.id_perfil_cliente
      WHERE pc.id_usuario = $1
      ORDER BY t.created_at DESC
    `, [id_usuario]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][transaccion] listar usuario error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/transacciones/guia/:id_perfil_guia
async function listarPorGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query(`
      SELECT t.*, r.id_perfil_guia, r.id_perfil_cliente, r.lugar, r.personas, r.fecha_reserva, r.hora_inicio, r.hora_fin
      FROM transaccion t
      JOIN reservas r ON r.id_reserva = t.id_reserva
      WHERE r.id_perfil_guia = $1
      ORDER BY t.created_at DESC
    `, [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][transaccion] listar guia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports.listarPorUsuario = listarPorUsuario;
module.exports.listarPorGuia = listarPorGuia;
