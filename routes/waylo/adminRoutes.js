const express = require('express');
const router = express.Router();

// Public admin auth (login/refresh)
const { loginAdmin, refreshToken, logoutAdmin } = require('../../controllers/waylo/admin/authAdminController');
router.post('/login', loginAdmin);
router.post('/refresh', refreshToken);

// TEMP: Make verification update public (no token) as requested
// Note: Keep other admin endpoints protected
const { setVerification } = require('../../controllers/waylo/admin/guiaAdminController');
router.put('/guias/:id/verify', setVerification);

// Protect remaining admin routes with middleware
const { requireAdmin } = require('../../middleware/authMiddleware');
router.use(requireAdmin);

// Logout (protected)
router.post('/logout', logoutAdmin);

// Users
const { listUsers, getUser, setRole, setState, setPassword } = require('../../controllers/waylo/admin/userAdminController');
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', setRole);
router.put('/users/:id/state', setState);
router.put('/users/:id/password', setPassword);

// Guides & documents
const { listGuias, getGuia, listDocumentos, setDocumentoEstado } = require('../../controllers/waylo/admin/guiaAdminController');
router.get('/guias', listGuias);
router.get('/guias/:id', getGuia);
router.get('/documentos', listDocumentos);
router.put('/documentos/:id_documento/estado', setDocumentoEstado);

// Reservas
const { listReservas, setReservaEstado, deleteReserva } = require('../../controllers/waylo/admin/reservaAdminController');
router.get('/reservas', listReservas);
router.put('/reservas/:id_reserva/estado', setReservaEstado);
router.delete('/reservas/:id_reserva', deleteReserva);

// Transacciones
const { listTransacciones, setTransaccionEstado } = require('../../controllers/waylo/admin/transaccionAdminController');
router.get('/transacciones', listTransacciones);
router.put('/transacciones/:id_transaccion/estado', setTransaccionEstado);

// Dashboard
const { summary } = require('../../controllers/waylo/admin/dashboardAdminController');
router.get('/dashboard/summary', summary);

module.exports = router;
