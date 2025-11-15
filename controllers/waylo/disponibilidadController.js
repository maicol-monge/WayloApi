const { db } = require('../../config/db');

// --- Horarios recurrentes ---
// Tabla propuesta: rango_recurrente(id_recurrente serial PK, id_perfil_guia int, weekday int (1=Dom..7=Sab), hora_inicio time, hora_fin time, habilitado boolean, estado char(1) default 'A')
// GET /api/waylo/disponibilidad/recurrente/:id_perfil_guia -> lista patrones
async function listarRecurrente(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query("SELECT * FROM rango_recurrente WHERE id_perfil_guia=$1 AND estado='A' ORDER BY weekday", [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][disponibilidad] listarRecurrente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/disponibilidad/recurrente/:id_perfil_guia -> reemplaza todos los patrones enviados
// body: { patrones: [ { weekday, habilitado, hora_inicio, hora_fin } ] }
async function guardarRecurrente(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const { patrones } = req.body;
    if (!Array.isArray(patrones)) return res.status(400).json({ success: false, message: 'patrones array requerido' });
    await db.query('BEGIN');
    // marcamos anteriores como inactivos
    await db.query("UPDATE rango_recurrente SET estado='I' WHERE id_perfil_guia=$1", [id_perfil_guia]);
    const inserted = [];
    for (const p of patrones) {
      const { weekday, habilitado, hora_inicio, hora_fin } = p;
      if (!weekday) continue;
      const ins = await db.query(
        'INSERT INTO rango_recurrente (id_perfil_guia, weekday, habilitado, hora_inicio, hora_fin, estado) VALUES ($1,$2,$3,$4,$5,\'A\') RETURNING *',
        [id_perfil_guia, weekday, habilitado === true, hora_inicio || null, hora_fin || null]
      );
      inserted.push(ins.rows[0]);
    }
    await db.query('COMMIT');
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('[waylo][disponibilidad] guardarRecurrente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/disponibilidad/recurrente/:id_perfil_guia/:weekday -> actualiza un patrón específico
// body: { habilitado, hora_inicio, hora_fin }
async function actualizarRecurrente(req, res) {
  try {
    const { id_perfil_guia, weekday } = req.params;
    const { habilitado, hora_inicio, hora_fin } = req.body;
    const upd = await db.query(
      "UPDATE rango_recurrente SET habilitado=$1, hora_inicio=$2, hora_fin=$3 WHERE id_perfil_guia=$4 AND weekday=$5 AND estado='A' RETURNING *",
      [habilitado === true, hora_inicio || null, hora_fin || null, id_perfil_guia, weekday]
    );
    if (upd.rowCount === 0) return res.status(404).json({ success: false, message: 'Patrón no encontrado' });
    res.json({ success: true, data: upd.rows[0] });
  } catch (err) {
    console.error('[waylo][disponibilidad] actualizarRecurrente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/disponibilidad/:id_perfil_guia
async function listar(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query('SELECT * FROM rango_disponible WHERE id_perfil_guia=$1 AND estado=\'A\' ORDER BY hora_inicio', [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][disponibilidad] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/disponibilidad/:id_perfil_guia
async function crear(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const { hora_inicio, hora_fin } = req.body;
    if (!hora_inicio || !hora_fin) return res.status(400).json({ success: false, message: 'hora_inicio y hora_fin requeridos' });
    const ins = await db.query('INSERT INTO rango_disponible (id_perfil_guia, hora_inicio, hora_fin) VALUES ($1,$2,$3) RETURNING *', [id_perfil_guia, hora_inicio, hora_fin]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][disponibilidad] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/disponibilidad/item/:id_rango_disponible
async function eliminar(req, res) {
  try {
    const { id_rango_disponible } = req.params;
    await db.query("UPDATE rango_disponible SET estado='I' WHERE id_rango_disponible=$1", [id_rango_disponible]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][disponibilidad] eliminar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, eliminar, listarRecurrente, guardarRecurrente, actualizarRecurrente };
