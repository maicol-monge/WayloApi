const express = require("express");
const router = express.Router();
const {
  realizarCanje,
  obtenerCanjesUsuario,
  obtenerCanjesTienda,
  verificarDisponibilidadCanje
} = require("../controllers/canjeController");
const {
  crearSesionCanje,
  confirmarSesionCanje,
} = require("../controllers/sesionCanjeController");

// ======================
// RUTAS DE CANJES
// ======================

// POST /api/canjes - Realizar nuevo canje
router.post("/", realizarCanje);

// POST /api/canjes/verificar - Verificar disponibilidad de canje
router.post("/verificar", verificarDisponibilidadCanje);

// GET /api/canjes/usuario/:id_usuario - Obtener canjes por usuario
router.get("/usuario/:id_usuario", obtenerCanjesUsuario);

// GET /api/canjes/tienda/:id_tienda - Obtener canjes por tienda
router.get("/tienda/:id_tienda", obtenerCanjesTienda);

// ======================
// RUTAS DE SESIÓN DE CANJE (QR)
// ======================

// POST /api/canjes/sesion - Crear sesión de canje (TIENDA genera QR)
router.post("/sesion", crearSesionCanje);

// POST /api/canjes/sesion/:id/confirmar - Confirmar sesión (USUARIO escanea)
router.post("/sesion/:id/confirmar", confirmarSesionCanje);

module.exports = router;