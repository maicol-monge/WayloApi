const express = require("express");
const router = express.Router();
const {
  registrarUsuario,
  loginUsuario,
  obtenerPerfilUsuario,
  actualizarPerfilUsuario,
  cambiarPasswordUsuario,
  obtenerHistorialReciclajes,
  obtenerHistorialCanjes,
  obtenerPuntosUsuario
} = require("../controllers/usuarioController");

// ======================
// RUTAS DE USUARIOS
// ======================

// POST /api/usuarios/registro - Registrar nuevo usuario
router.post("/registro", registrarUsuario);

// POST /api/usuarios/login - Login de usuario
router.post("/login", loginUsuario);

// GET /api/usuarios/perfil/:id_usuario - Obtener perfil de usuario
router.get("/perfil/:id_usuario", obtenerPerfilUsuario);

// PUT /api/usuarios/perfil/:id_usuario - Actualizar perfil de usuario
router.put("/perfil/:id_usuario", actualizarPerfilUsuario);

// PUT /api/usuarios/:id_usuario/password - Cambiar contraseña de usuario
router.put("/:id_usuario/password", cambiarPasswordUsuario);

// GET /api/usuarios/:id_usuario/puntos - Obtener puntos acumulados
router.get("/:id_usuario/puntos", obtenerPuntosUsuario);

// GET /api/usuarios/:id_usuario/reciclajes - Historial de reciclajes
router.get("/:id_usuario/reciclajes", obtenerHistorialReciclajes);

// GET /api/usuarios/:id_usuario/canjes - Historial de canjes
router.get("/:id_usuario/canjes", obtenerHistorialCanjes);

module.exports = router;