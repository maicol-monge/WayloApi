const express = require('express');
const router = express.Router();

// Users
const { listUsers, getUser, setRole, setState, setPassword } = require('../../controllers/waylo/admin/userAdminController');
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', setRole);
router.put('/users/:id/state', setState);
router.put('/users/:id/password', setPassword);

// Guides & documents
const { listGuias, getGuia, setVerification, listDocumentos, setDocumentoEstado } = require('../../controllers/waylo/admin/guiaAdminController');
router.get('/guias', listGuias);
router.get('/guias/:id', getGuia);
router.put('/guias/:id/verify', setVerification);
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
