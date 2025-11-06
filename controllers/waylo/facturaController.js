const { db } = require('../../config/db');

// POST /api/waylo/facturas
async function crear(req, res) {
  try {
    const { id_transaccion, id_perfil_guia, id_perfil_cliente, monto_total } = req.body;
    if (!id_transaccion) return res.status(400).json({ success: false, message: 'id_transaccion requerido' });
    let total = monto_total;
    if (total === undefined || total === null) {
      const t = await db.query('SELECT monto_total FROM transaccion WHERE id_transaccion=$1', [id_transaccion]);
      if (t.rows.length) total = t.rows[0].monto_total;
    }
    const ins = await db.query(
      `INSERT INTO factura (id_transaccion, id_perfil_guia, id_perfil_cliente, monto_total)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id_transaccion, id_perfil_guia || null, id_perfil_cliente || null, total || null]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][factura] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/facturas/transaccion/:id_transaccion
async function getByTransaccion(req, res) {
  try {
    const { id_transaccion } = req.params;
    const q = await db.query('SELECT * FROM factura WHERE id_transaccion=$1', [id_transaccion]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][factura] getByTransaccion error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/facturas/guia/:id_perfil_guia
async function listarPorGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query('SELECT * FROM factura WHERE id_perfil_guia=$1 ORDER BY created_at DESC', [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][factura] listar guia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/facturas/cliente/:id_perfil_cliente
async function listarPorCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    const q = await db.query('SELECT * FROM factura WHERE id_perfil_cliente=$1 ORDER BY created_at DESC', [id_perfil_cliente]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][factura] listar cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crear, getByTransaccion, listarPorGuia, listarPorCliente };
