# Waylo API (v1)

Base path: `/api/waylo`

Auth

- POST `/auth/registro/cliente` { nombre, email, contrasena }
- POST `/auth/registro/guia` { nombre, email, contrasena, descripcion?, idiomas?:[{nombre,nivel?}], ciudad?, pais?, anios_experiencia?, precio_hora?, precio_dia_personalizado? }
- POST `/auth/login` { email, contrasena }

Perfiles

- GET `/guias` filtros: ciudad, idioma, precio_min, precio_max, rating_min, q, page, pageSize
- GET `/guias/:id`
- PUT `/guias/:id` { descripcion?, pais?, ciudad?, anios_experiencia?, precio_hora?, precio_dia_personalizado? }
- GET `/clientes/:id`
- PUT `/clientes/:id` { descripcion?, pais?, ciudad? }

Idiomas

- GET `/idiomas/:id_usuario`
- POST `/idiomas/:id_usuario` { nombre, nivel? }
- DELETE `/idiomas/item/:id_idioma`

Documentos (guía)

- POST `/documentos/:id_perfil_guia` (multipart form) file: `file`, body: { tipo_documento? }

Media

- POST `/media/upload/foto` (multipart) -> bucket folder `fotos`
- POST `/media/upload/foto-perfil` (multipart) body: { tipo: guia|cliente, id } -> folder `foto-perfil`
- POST `/media/guias/:id_perfil_guia/fotos` (multipart) body: { descripcion? } -> crea en `fotos_guia`

Disponibilidad

- GET `/disponibilidad/:id_perfil_guia`
- POST `/disponibilidad/:id_perfil_guia` { hora_inicio, hora_fin }
- DELETE `/disponibilidad/item/:id_rango_disponible`

Reservas

- POST `/reservas` { id_perfil_guia, id_perfil_cliente, lugar?, personas?, hora_inicio, hora_fin, monto }
- GET `/reservas/guia/:id_perfil_guia`
- GET `/reservas/cliente/:id_perfil_cliente`
- PUT `/reservas/:id_reserva/estado` { estado_reserva }

Transacciones

- POST `/transacciones` { id_reserva, metodo_pago?, monto_total, comision_guia?, comision_cliente?, estado_transaccion? }

Chat

- POST `/conversaciones` { id_usuario1, id_usuario2 }
- GET `/conversaciones/:id_usuario`
- POST `/mensajes` { id_conversacion, id_usuario_sender, mensaje?, media_url? }
- GET `/mensajes/:id_conversacion`

Notificaciones

- GET `/notificaciones/:id_usuario`
- POST `/notificaciones` { id_usuario, tipo?, titulo, mensaje? }
- PUT `/notificaciones/:id_notificacion/read`

Reseñas

- POST `/resenas` { id_reserva?, id_perfil_cliente, id_perfil_guia, calificacion, comentario? }
- GET `/resenas/guia/:id_perfil_guia`

Configuración

- GET `/config/:id_usuario`
- PUT `/config/:id_usuario` { idioma_aplicacion?, permitir_notificaciones?, zona_horaria? }

Favoritos

- POST `/favoritos` { id_perfil_guia, id_perfil_cliente }
- DELETE `/favoritos` { id_perfil_guia, id_perfil_cliente }
- GET `/favoritos/cliente/:id_perfil_cliente`

Notas

- Bucket de storage: `waylo_images` con carpetas: `fotos`, `foto-perfil`, `documentos`.
- Requiere variables de entorno de Supabase y DATABASE_URL.
