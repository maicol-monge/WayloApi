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
