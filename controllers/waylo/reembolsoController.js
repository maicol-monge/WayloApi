const { db } = require('../../config/db');

// Helper to compute monto from politica if not provided
async function calcularMontoDesdePolitica(id_reserva, id_politica_reembolso) {
  const r = await db.query('SELECT monto_total FROM reservas WHERE id_reserva=$1', [id_reserva]);
  if (!r.rows.length) throw new Error('Reserva no encontrada');
  const total = Number(r.rows[0].monto_total || 0);
  if (!id_politica_reembolso) return null;
  const p = await db.query('SELECT porcentaje_reembolso FROM politica_reembolso WHERE id_politica_reembolso=$1', [id_politica_reembolso]);
  if (!p.rows.length) return null;
  const porc = Number(p.rows[0].porcentaje_reembolso || 0);
  if (!isFinite(total) || !isFinite(porc)) return null;
  return Number(((total * porc) / 100).toFixed(2));
}

// POST /api/waylo/reembolsos
async function crear(req, res) {
  try {
    const { id_reserva, id_politica_reembolso, monto } = req.body;
    if (!id_reserva) return res.status(400).json({ success: false, message: 'id_reserva requerido' });
    let montoCalc = monto;
    if (montoCalc === undefined || montoCalc === null) {
      montoCalc = await calcularMontoDesdePolitica(id_reserva, id_politica_reembolso);
    }
    const ins = await db.query(
      `INSERT INTO reembolso_reserva (id_reserva, id_politica_reembolso, monto)
       VALUES ($1,$2,$3) RETURNING *`,
      [id_reserva, id_politica_reembolso || null, montoCalc || null]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][reembolso] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/reembolsos/reserva/:id_reserva
async function listarPorReserva(req, res) {
  try {
    const { id_reserva } = req.params;
    const q = await db.query('SELECT * FROM reembolso_reserva WHERE id_reserva=$1 ORDER BY created_at DESC', [id_reserva]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][reembolso] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/reembolsos/:id/estado
async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado_reembolso } = req.body; // pendiente, procesador, rechazado
    if (!estado_reembolso) return res.status(400).json({ success: false, message: 'estado_reembolso requerido' });
    const up = await db.query('UPDATE reembolso_reserva SET estado_reembolso=$1 WHERE id_reembolso_reserva=$2 RETURNING *', [estado_reembolso, id]);
    if (!up.rows.length) return res.status(404).json({ success: false, message: 'Reembolso no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][reembolso] actualizar estado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crear, listarPorReserva, actualizarEstado };
