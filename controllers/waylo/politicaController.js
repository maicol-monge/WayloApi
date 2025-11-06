const { db } = require('../../config/db');

// GET /api/waylo/politicas
async function listar(req, res) {
  try {
    const { estado = 'A' } = req.query;
    const q = await db.query('SELECT * FROM politica_reembolso WHERE ($1::text IS NULL OR estado=$1) ORDER BY created_at DESC', [estado]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][politica] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/politicas/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const q = await db.query('SELECT * FROM politica_reembolso WHERE id_politica_reembolso=$1', [id]);
    if (!q.rows.length) return res.status(404).json({ success: false, message: 'Política no encontrada' });
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('[waylo][politica] obtener error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/politicas
async function crear(req, res) {
  try {
    const { nombre, descripcion, porcentaje_reembolso, fecha_limite, estado = 'A' } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'nombre requerido' });
    const ins = await db.query(
      `INSERT INTO politica_reembolso (nombre, descripcion, porcentaje_reembolso, fecha_limite, estado)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, descripcion || null, porcentaje_reembolso || null, fecha_limite || null, estado]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][politica] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/politicas/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, porcentaje_reembolso, fecha_limite, estado } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) { fields.push(`nombre=$${idx++}`); params.push(nombre); }
    if (descripcion !== undefined) { fields.push(`descripcion=$${idx++}`); params.push(descripcion); }
    if (porcentaje_reembolso !== undefined) { fields.push(`porcentaje_reembolso=$${idx++}`); params.push(porcentaje_reembolso); }
    if (fecha_limite !== undefined) { fields.push(`fecha_limite=$${idx++}`); params.push(fecha_limite); }
    if (estado !== undefined) { fields.push(`estado=$${idx++}`); params.push(estado); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    params.push(id);
    const up = await db.query(`UPDATE politica_reembolso SET ${fields.join(', ')} WHERE id_politica_reembolso=$${idx} RETURNING *`, params);
    if (!up.rows.length) return res.status(404).json({ success: false, message: 'Política no encontrada' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][politica] actualizar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/politicas/:id (soft delete)
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    await db.query("UPDATE politica_reembolso SET estado='I' WHERE id_politica_reembolso=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][politica] eliminar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
