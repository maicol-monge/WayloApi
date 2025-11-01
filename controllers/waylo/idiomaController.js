const { db } = require('../../config/db');

// GET /api/waylo/idiomas/:id_usuario
async function listarIdiomas(req, res) {
  try {
    const { id_usuario } = req.params;
    const q = await db.query('SELECT * FROM idiomas WHERE id_usuario=$1', [id_usuario]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][idiomas] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/idiomas/:id_usuario
async function agregarIdioma(req, res) {
  try {
    const { id_usuario } = req.params;
    const { nombre, nivel = 'intermedio' } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'nombre requerido' });
    const ins = await db.query('INSERT INTO idiomas (id_usuario, nombre, nivel) VALUES ($1,$2,$3) RETURNING *', [id_usuario, nombre, nivel]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][idiomas] agregar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/idiomas/:id_idioma
async function eliminarIdioma(req, res) {
  try {
    const { id_idioma } = req.params;
    await db.query('DELETE FROM idiomas WHERE id_idioma=$1', [id_idioma]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][idiomas] eliminar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listarIdiomas, agregarIdioma, eliminarIdioma };
