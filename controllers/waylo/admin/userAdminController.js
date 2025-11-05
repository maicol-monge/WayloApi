const { db } = require('../../../config/db');
const bcrypt = require('bcryptjs');

// GET /api/waylo/admin/users
async function listUsers(req, res) {
  try {
    const { role, estado, q, page = 1, pageSize = 50 } = req.query;
    const params = [];
    let where = [];
    let idx = 1;
    if (role) { where.push(`LOWER(r.nombre)=LOWER($${idx++})`); params.push(role); }
    if (estado) { where.push(`u.estado=$${idx++}`); params.push(estado); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(u.email) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }

    const offset = (Number(page) -1) * Number(pageSize);
    const sql = `SELECT u.id_usuario, u.nombre, u.email, u.estado, u.created_at, r.nombre as rol
                 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY u.created_at DESC
                 LIMIT ${Number(pageSize)} OFFSET ${offset}`;
    const qres = await db.query(sql, params);
    res.json({ success: true, data: qres.rows });
  } catch (err) {
    console.error('[admin][users] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/admin/users/:id
async function getUser(req, res) {
  try {
    const { id } = req.params;
    const q = await db.query('SELECT u.*, r.nombre as rol FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario=$1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const user = q.rows[0];
    // try to fetch profiles
    const guia = await db.query('SELECT * FROM perfil_guia WHERE id_usuario=$1', [user.id_usuario]);
    const cliente = await db.query('SELECT * FROM perfil_cliente WHERE id_usuario=$1', [user.id_usuario]);
    res.json({ success: true, data: { user, guia: guia.rows[0] || null, cliente: cliente.rows[0] || null } });
  } catch (err) {
    console.error('[admin][users] get error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/users/:id/role
async function setRole(req, res) {
  try {
    const { id } = req.params;
    const { id_rol } = req.body;
    if (!id_rol) return res.status(400).json({ success: false, message: 'id_rol requerido' });
    const up = await db.query('UPDATE usuario SET id_rol=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING *', [id_rol, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setRole error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/users/:id/state
async function setState(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'A' or 'I'
    if (!estado) return res.status(400).json({ success: false, message: 'estado requerido' });
    const up = await db.query('UPDATE usuario SET estado=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING *', [estado, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setState error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/users/:id/password
async function setPassword(req, res) {
  try {
    const { id } = req.params;
    const { contrasena } = req.body;
    if (!contrasena) return res.status(400).json({ success: false, message: 'contrasena requerida' });
    const hash = await bcrypt.hash(contrasena, 10);
    const up = await db.query('UPDATE usuario SET contrasena=$1, updated_at=NOW() WHERE id_usuario=$2 RETURNING id_usuario, email, nombre', [hash, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][users] setPassword error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listUsers, getUser, setRole, setState, setPassword };
