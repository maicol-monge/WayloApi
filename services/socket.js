const { Server } = require('socket.io');
const { db } = require('../config/db');

let ioInstance = null;

function initSocket(httpServer, corsOrigins = ['*']) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log('[socket] Cliente conectado:', socket.id);

    // Join a conversation room
    socket.on('join_conversation', ({ id_conversacion }) => {
      if (!id_conversacion) return;
      socket.join(`conv:${id_conversacion}`);
      console.log(`[socket] Cliente ${socket.id} unido a conv:${id_conversacion}`);
    });

    // Typing indicators
    socket.on('typing_start', ({ id_conversacion, user_id }) => {
      if (!id_conversacion || !user_id) return;
      socket.to(`conv:${id_conversacion}`).emit('typing', { id_conversacion, user_id, typing: true });
    });
    socket.on('typing_stop', ({ id_conversacion, user_id }) => {
      if (!id_conversacion || !user_id) return;
      socket.to(`conv:${id_conversacion}`).emit('typing', { id_conversacion, user_id, typing: false });
    });

    // Send message via WS -> persist -> broadcast
    socket.on('message_send', async (payload, ack) => {
      try {
        const { id_conversacion, id_usuario_sender, mensaje, media_url } = payload || {};
        if (!id_conversacion || !id_usuario_sender || (!mensaje && !media_url)) {
          if (ack) ack({ success: false, message: 'Campos requeridos: id_conversacion, id_usuario_sender y mensaje o media_url' });
          return;
        }
        const ins = await db.query(
          'INSERT INTO mensaje (id_conversacion, id_usuario_sender, mensaje, media_url) VALUES ($1,$2,$3,$4) RETURNING *',
          [id_conversacion, id_usuario_sender, mensaje || null, media_url || null]
        );
        const saved = ins.rows[0];
        ioInstance.to(`conv:${id_conversacion}`).emit('message_new', { mensaje: saved });
        if (ack) ack({ success: true, data: saved });
      } catch (err) {
        console.error('[socket] message_send error:', err);
        if (ack) ack({ success: false, message: 'Error interno del servidor' });
      }
    });

    socket.on('disconnect', () => {
      console.log('[socket] Cliente desconectado:', socket.id);
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.IO no inicializado');
  return ioInstance;
}

module.exports = { initSocket, getIO };
