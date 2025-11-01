const { db } = require("../config/db");

// ======================
// SESIONES DE CANJE (QR)
// ======================

// Crear sesión de canje (la TIENDA genera el QR)
// Body: { id_tienda, id_producto, cantidad_producto }
const crearSesionCanje = async (req, res) => {
  try {
    const { id_tienda, id_producto, cantidad_producto } = req.body;

    if (!id_tienda || !id_producto) {
      return res.status(400).json({
        success: false,
        message: "id_tienda e id_producto son requeridos",
      });
    }

    const cantidad = Math.max(1, parseInt(cantidad_producto || 1, 10));

    // Validar tienda activa
    const tienda = await db.query(
      "SELECT id_tienda FROM Tienda WHERE id_tienda = $1 AND estado = 'A'",
      [id_tienda]
    );
    if (tienda.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    // Validar producto activo y que pertenezca a la tienda
    const producto = await db.query(
      `SELECT p.id_producto, p.nombre, p.costo_puntos, p.stock, p.estado, p.id_tienda,
              t.nombre AS tienda_nombre
       FROM Productos p
       JOIN Tienda t ON t.id_tienda = p.id_tienda AND t.estado = 'A'
       WHERE p.id_producto = $1 AND p.estado = 'A'`,
      [id_producto]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }

    const prod = producto.rows[0];

    if (parseInt(id_tienda, 10) !== prod.id_tienda) {
      return res.status(400).json({ success: false, message: "El producto no pertenece a la tienda" });
    }

    if (prod.stock < cantidad) {
      return res.status(400).json({ success: false, message: "Producto sin stock suficiente" });
    }

    const costoTotal = prod.costo_puntos * cantidad;

    // Crear sesión (estado PENDIENTE por defecto, id UUID por defecto)
    const sesion = await db.query(
      `INSERT INTO CanjeSesiones (id_tienda, id_producto, cantidad, puntos_requeridos)
       VALUES ($1, $2, $3, $4)
       RETURNING id AS sesion_id, creado_en, expira_en, estado` ,
      [id_tienda, id_producto, cantidad, costoTotal]
    );

    return res.status(201).json({
      success: true,
      message: "Sesión de canje creada",
      data: {
        ...sesion.rows[0],
        id_tienda: prod.id_tienda,
        id_producto: prod.id_producto,
        producto_nombre: prod.nombre,
        tienda_nombre: prod.tienda_nombre,
        cantidad,
        puntos_requeridos: costoTotal,
      },
    });
  } catch (error) {
    console.error("Error al crear sesión de canje:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Confirmar sesión (el USUARIO escanea el QR y confirma)
// Params: :id (sesion_id)
// Body: { id_usuario, id_tienda (opcional), id_producto_usuario, cantidad_usuario }
const confirmarSesionCanje = async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params; // sesion_id (UUID)
    const { id_usuario, id_tienda, id_producto_usuario, cantidad_usuario } = req.body;

    if (!id || !id_usuario || !id_producto_usuario || !cantidad_usuario) {
      return res.status(400).json({
        success: false,
        message: "sesion_id, id_usuario, id_producto_usuario y cantidad_usuario son requeridos",
      });
    }

    const cantidadU = Math.max(1, parseInt(cantidad_usuario, 10));

    await client.query("BEGIN");

    // Bloquear la sesión para evitar condiciones de carrera
    const sesion = await client.query(
      `SELECT * FROM CanjeSesiones WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (sesion.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sesión no encontrada" });
    }

    const s = sesion.rows[0];

    if (s.estado !== "PENDIENTE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Sesión no disponible" });
    }

    // Verificar expiración
    const expirada = await client.query(`SELECT NOW() > $1 AS exp`, [s.expira_en]);
    if (expirada.rows[0].exp) {
      await client.query(
        `UPDATE CanjeSesiones SET estado = 'EXPIRADA' WHERE id = $1`,
        [id]
      );
      await client.query("COMMIT");
      return res.status(400).json({ success: false, message: "Sesión expirada" });
    }

    // Validaciones de coincidencia
    if (id_tienda && parseInt(id_tienda, 10) !== s.id_tienda) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "id_tienda no coincide" });
    }

    if (parseInt(id_producto_usuario, 10) !== s.id_producto) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "id_producto no coincide" });
    }

    if (cantidadU !== parseInt(s.cantidad, 10)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "cantidad no coincide" });
    }

    // Revalidar producto y stock (bloquear fila de producto)
    const producto = await client.query(
      `SELECT p.*, t.nombre AS tienda_nombre
       FROM Productos p
       JOIN Tienda t ON t.id_tienda = p.id_tienda AND t.estado = 'A'
       WHERE p.id_producto = $1 AND p.estado = 'A'
       FOR UPDATE`,
      [s.id_producto]
    );

    if (producto.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Producto no disponible" });
    }

    const prod = producto.rows[0];

    if (prod.stock < cantidadU) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Producto sin stock suficiente" });
    }

    // Recalcular costo actual y comparar con puntos_requeridos para evitar discrepancias
    const costoActual = prod.costo_puntos * cantidadU;
    if (costoActual !== parseInt(s.puntos_requeridos, 10)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "El costo del producto cambió. Por favor, genera un nuevo QR.",
      });
    }

    // Bloquear fila de usuario y verificar puntos
    const usuario = await client.query(
      `SELECT id_usuario, puntos_acumulados FROM Usuarios WHERE id_usuario = $1 AND estado = 'A' FOR UPDATE`,
      [id_usuario]
    );
    if (usuario.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const puntosActuales = parseInt(usuario.rows[0].puntos_acumulados, 10) || 0;
    if (puntosActuales < costoActual) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Puntos insuficientes" });
    }

    // Registrar canje
    const canje = await client.query(
      `INSERT INTO Canjes (id_tienda, id_usuario, id_producto, puntos_usados, cantidad_producto, estado)
       VALUES ($1, $2, $3, $4, $5, 'A')
       RETURNING *`,
      [s.id_tienda, id_usuario, s.id_producto, costoActual, cantidadU]
    );

    // Actualizar puntos del usuario
    await client.query(
      `UPDATE Usuarios SET puntos_acumulados = puntos_acumulados - $1 WHERE id_usuario = $2`,
      [costoActual, id_usuario]
    );

    // Actualizar stock del producto
    await client.query(
      `UPDATE Productos SET stock = stock - $1 WHERE id_producto = $2`,
      [cantidadU, s.id_producto]
    );

    // Nota: No se inserta snapshot en HistorialPuntaje para deducciones de puntos.

    // Marcar sesión como confirmada
    await client.query(
      `UPDATE CanjeSesiones SET estado = 'CONFIRMADA', confirmado_por = $2, confirmado_en = NOW() WHERE id = $1`,
      [id, id_usuario]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Canje confirmado",
      data: {
        ...canje.rows[0],
        puntos_usados: costoActual,
        producto_nombre: prod.nombre,
        tienda_nombre: prod.tienda_nombre,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al confirmar sesión de canje:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

module.exports = {
  crearSesionCanje,
  confirmarSesionCanje,
};
