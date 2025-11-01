const express = require("express");
const router = express.Router();
const {
  upload,
  crearProducto,
  obtenerProductos,
  obtenerProductoPorId,
  buscarProductos,
  actualizarProducto,
  eliminarProducto,
  obtenerProductosAgotados,
  obtenerProductosConStock,
  obtenerTodosProductos
} = require("../controllers/productoController");

// ======================
// RUTAS DE PRODUCTOS
// ======================

// POST /api/productos - Crear nuevo producto (con imagen)
router.post("/", upload.single('imagen'), crearProducto);

// GET /api/productos - Obtener todos los productos
router.get("/", obtenerProductos);

// GET /api/productos/agotados - Productos con stock 0 o menor
router.get("/agotados", obtenerProductosAgotados);

// GET /api/productos/con-stock - Productos con al menos 1 en stock
router.get("/con-stock", obtenerProductosConStock);

// GET /api/productos/todos - Productos activos con o sin stock
router.get("/todos", obtenerTodosProductos);

// GET /api/productos/buscar?q=termino - Buscar productos
router.get("/buscar", buscarProductos);

// GET /api/productos/:id_producto - Obtener producto por ID
router.get("/:id_producto", obtenerProductoPorId);

// PUT /api/productos/:id_producto - Actualizar producto (con imagen opcional)
router.put("/:id_producto", upload.single('imagen'), actualizarProducto);

// DELETE /api/productos/:id_producto - Eliminar producto
router.delete("/:id_producto", eliminarProducto);

module.exports = router;