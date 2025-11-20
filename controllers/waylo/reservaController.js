const { db } = require('../../config/db');

// POST /api/waylo/reservas
async function crearReserva(req, res) {
  try {
    const { id_perfil_guia, id_perfil_cliente, lugar, personas, hora_inicio, hora_fin, monto } = req.body;
    if (!id_perfil_guia || !id_perfil_cliente || !hora_inicio || !hora_fin || !monto) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: id_perfil_guia, id_perfil_cliente, hora_inicio, hora_fin, monto' });
    }

    // Validación: hora_fin debe ser mayor que hora_inicio
    if (new Date(hora_fin) <= new Date(hora_inicio)) {
      return res.status(400).json({ success: false, message: 'hora_fin debe ser mayor que hora_inicio' });
    }

    // Validación solapamiento: existe reserva (Pendiente o Confirmada) que se cruza con el rango propuesto
    try {
      const overlapQ = await db.query(
        `SELECT 1 FROM reservas
         WHERE id_perfil_guia = $1
           AND estado_reserva IN ('Pendiente','Confirmada')
           AND NOT ($3 <= hora_inicio OR $2 >= hora_fin)
         LIMIT 1`,
        [id_perfil_guia, hora_inicio, hora_fin]
      );
      if (overlapQ.rows.length) {
        return res.status(409).json({ success: false, message: 'Existe otra reserva que se solapa con este horario' });
      }
    } catch (e) {
      console.error('[waylo][reservas] overlap check error:', e);
    }

  // Nueva lógica de comisiones:
  // Cliente paga monto base + 2.5%
  // Guía recibe monto base - 15%
  // La app retiene 15% (comision guía) + 2.5% (comision cliente)
  const montoBase = Number(monto);
  const comision = Number((montoBase * 0.15).toFixed(2)); // retención sobre pago al guía
  const comisionCliente = Number((montoBase * 0.025).toFixed(2)); // recargo al cliente
  const monto_total = Number((montoBase + comisionCliente).toFixed(2)); // total que paga el cliente

    const ins = await db.query(
      `INSERT INTO reservas (id_perfil_guia, id_perfil_cliente, lugar, personas, hora_inicio, hora_fin, monto, comision, monto_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id_perfil_guia, id_perfil_cliente, lugar || null, personas || null, hora_inicio, hora_fin, montoBase.toFixed(2), comision, monto_total]
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

// PUT /api/waylo/reservas/:id_reserva/aceptar
// El guía dueño de la reserva cambia de Pendiente -> Confirmada
async function aceptarReserva(req, res) {
  try {
    const { id_reserva } = req.params;
    // obtener reserva + dueño (usuario guía)
    const q = await db.query(
      `SELECT r.*, pg.id_usuario AS id_usuario_guia
       FROM reservas r
       JOIN perfil_guia pg ON pg.id_perfil_guia = r.id_perfil_guia
       WHERE r.id_reserva = $1
       LIMIT 1`,
      [id_reserva]
    );
    if (!q.rows.length) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    const row = q.rows[0];
    if (!req.user || String(req.user.id_usuario) !== String(row.id_usuario_guia)) {
      return res.status(403).json({ success: false, message: 'No autorizado para aceptar esta reserva' });
    }
    if (row.estado_reserva !== 'Pendiente') {
      return res.status(400).json({ success: false, message: 'La reserva no está en estado Pendiente' });
    }
    const up = await db.query('UPDATE reservas SET estado_reserva=$1, updated_at=NOW() WHERE id_reserva=$2 RETURNING *', ['Confirmada', id_reserva]);
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][reservas] aceptar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/reservas/:id_reserva/pagar
// Cliente realiza el pago de una reserva confirmada. Marca estado_pago=pagado y crea transaccion.
async function pagarReserva(req, res) {
  try {
    const { id_reserva } = req.params;
    // obtener reserva
    const q = await db.query('SELECT * FROM reservas WHERE id_reserva=$1 LIMIT 1', [id_reserva]);
    if (!q.rows.length) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    const row = q.rows[0];
    if (row.estado_reserva !== 'Confirmada') {
      return res.status(400).json({ success: false, message: 'La reserva debe estar Confirmada antes de pagar' });
    }
    if (row.estado_pago === 'pagado') {
      return res.status(400).json({ success: false, message: 'La reserva ya fue pagada' });
    }
    // crear transaccion (usa comision y calcula comision_cliente desde monto y comision si no existe)
    const montoBase = Number(row.monto);
    const comisionGuia = Number(row.comision); // 15% retenido guía
    const comisionCliente = Number((montoBase * 0.025).toFixed(2)); // 2.5% recargo cliente
    const montoTotal = Number(row.monto_total); // monto que paga el cliente (base + 2.5%)

    const insTx = await db.query(
      `INSERT INTO transaccion (id_reserva, metodo_pago, monto_total, comision_guia, comision_cliente, estado_transaccion)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id_reserva, 'tarjeta', montoTotal.toFixed(2), comisionGuia.toFixed(2), comisionCliente.toFixed(2), 'exitosa']
    );

    const up = await db.query('UPDATE reservas SET estado_pago=$1, updated_at=NOW() WHERE id_reserva=$2 RETURNING *', ['pagado', id_reserva]);
    res.json({ success: true, data: up.rows[0], transaccion: insTx.rows[0] });
  } catch (err) {
    console.error('[waylo][reservas] pagar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearReserva, reservasDeGuia, reservasDeCliente, actualizarEstado, aceptarReserva, pagarReserva };
