const express = require("express");
const router = express.Router();
const {
  registrarTienda,
  loginTienda,
  obtenerTiendas,
  obtenerTiendaPorId,
  obtenerProductosTienda,
  obtenerPuntosRedimidosTienda,
  actualizarPerfilTienda,
  cambiarPasswordTienda
} = require("../controllers/tiendaController");

// ======================
// RUTAS DE TIENDAS
// ======================

// POST /api/tiendas/registro - Registrar nueva tienda
router.post("/registro", registrarTienda);

// POST /api/tiendas/login - Login de tienda
router.post("/login", loginTienda);

// GET /api/tiendas - Obtener todas las tiendas
router.get("/", obtenerTiendas);

// GET /api/tiendas/:id_tienda - Obtener tienda por ID
router.get("/:id_tienda", obtenerTiendaPorId);

// GET /api/tiendas/:id_tienda/productos - Obtener productos de una tienda
router.get("/:id_tienda/productos", obtenerProductosTienda);

// GET /api/tiendas/:id_tienda/puntos-redimidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Devuelve la suma de puntos_usados (canjeados) en la tienda y métricas básicas
router.get("/:id_tienda/puntos-redimidos", obtenerPuntosRedimidosTienda);

// PUT /api/tiendas/:id_tienda - Actualizar perfil de tienda
router.put("/:id_tienda", actualizarPerfilTienda);

// PUT /api/tiendas/:id_tienda/password - Cambiar contraseña de tienda
router.put("/:id_tienda/password", cambiarPasswordTienda);

module.exports = router;