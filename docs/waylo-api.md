# Waylo API (v1)

Base path: `/api/waylo`

Auth

- POST `/auth/registro/cliente` (multipart opcional file: `file`) { nombre, email, contrasena, descripcion?, pais?, ciudad? }
- POST `/auth/registro/guia` (multipart opcional file: `file`) { nombre, email, contrasena, descripcion?, idiomas?:[{nombre,nivel?}], ciudad?, pais?, anios_experiencia?, precio_hora?, precio_dia_personalizado? }
- POST `/auth/login` { email, contrasena } -> responde con usuario (incluye estado y timestamps), perfil (guia|cliente) y tokens
- POST `/auth/refresh` { refreshToken }
- POST `/auth/logout` (Bearer token)
- POST `/auth/password/forgot` { email }
- POST `/auth/password/reset` { token, nuevaContrasena }

Perfiles

- GET `/guias` filtros: ciudad, idioma, precio_min, precio_max, rating_min, q, page, pageSize
- GET `/guias/:id`
- PUT `/guias/:id` { descripcion?, pais?, ciudad?, anios_experiencia?, precio_hora?, precio_dia_personalizado? }
- GET incluye: fotos, resenas y idiomas del guía
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

Políticas de reembolso

- GET `/politicas` (query: estado?)
- GET `/politicas/:id`
- POST `/politicas` { nombre, descripcion?, porcentaje_reembolso?, fecha_limite?, estado? } (admin)
- PUT `/politicas/:id` { nombre?, descripcion?, porcentaje_reembolso?, fecha_limite?, estado? } (admin)
- DELETE `/politicas/:id` (soft delete, admin)

Reembolsos de reserva

- POST `/reembolsos` { id_reserva, id_politica_reembolso?, monto? } (autenticado)
- GET `/reembolsos/reserva/:id_reserva` (autenticado)
- PUT `/reembolsos/:id/estado` { estado_reembolso } (admin)

Transacciones

- POST `/transacciones` { id_reserva, metodo_pago?, monto_total, comision_guia?, comision_cliente?, estado_transaccion? }
- GET `/transacciones/usuario/:id_usuario`
- GET `/transacciones/guia/:id_perfil_guia`

Facturas

- POST `/facturas` { id_transaccion, id_perfil_guia?, id_perfil_cliente?, monto_total? } (admin)
- GET `/facturas/transaccion/:id_transaccion`
- GET `/facturas/guia/:id_perfil_guia`
- GET `/facturas/cliente/:id_perfil_cliente`

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

Respuestas a reseñas

- POST `/respuestas` { id_resena, id_usuario, comentario } (autenticado)
- GET `/respuestas/resena/:id_resena`

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
