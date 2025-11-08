-- ============================================================
-- SCRIPT ÚNICO DE CREACIÓN DE BASE DE DATOS WAYLO (PostgreSQL)
-- PKs autoincrementales con SERIAL y todas las FKs declaradas
-- Basado en WAYLO DER.pdf
-- ============================================================
-- ========================
-- Tipos ENUM usados
-- ========================
CREATE TYPE estado_verificacion AS ENUM ('pendiente','aprobado','rechazado');
CREATE TYPE nivel_idioma AS ENUM ('nativo','avanzado','intermedio','basico');
CREATE TYPE estado_doc AS ENUM ('pendiente','aprobado','rechazado');
CREATE TYPE estado_reserva AS ENUM ('Confirmada','Completada','Pendiente','Cancelada');
CREATE TYPE estado_pago AS ENUM ('pendiente','pagado','reembolsado');
CREATE TYPE estado_reembolso AS ENUM ('pendiente','procesador','rechazado');
CREATE TYPE estado_transaccion AS ENUM ('pendiente','exitosa','fallida');
CREATE TYPE tipo_notificacion AS ENUM ('mensaje','reserva','pago','otros');
CREATE TYPE idioma_app AS ENUM ('ES','EN');
CREATE TYPE zona_horaria AS ENUM (
  'UTC-11','UTC-10','UTC-9','UTC-8','UTC-7','UTC-6','UTC-5','UTC-4','UTC-3','UTC-2','UTC-1',
  'UTC+0','UTC+1','UTC+2','UTC+3','UTC+4','UTC+5','UTC+6','UTC+7','UTC+8','UTC+9','UTC+10','UTC+11','UTC+12'
);

-- ============================================================
-- TABLA: rol
-- ============================================================
CREATE TABLE rol (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200)
);

-- ============================================================
-- TABLA: usuario
-- ============================================================
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(250) NOT NULL,
    id_rol INT NOT NULL,
    estado CHAR(1) DEFAULT 'A',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol) ON DELETE RESTRICT
);

-- ============================================================
-- TABLA: token_sesion
-- ============================================================
CREATE TABLE token_sesion (
    id_token_sesion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    refresh_token VARCHAR(512),
    expires_at TIMESTAMP,
    revoked CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_token_sesion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: token_reset
-- ============================================================
CREATE TABLE token_reset (
    id_token_reset SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP,
    usado CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_token_reset_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: perfil_guia
-- ============================================================
CREATE TABLE perfil_guia (
    id_perfil_guia SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    descripcion VARCHAR(250),
    pais VARCHAR(100),
    ciudad VARCHAR(250),
    imagen_perfil TEXT,
    anios_experiencia INT,
    precio_hora DECIMAL(10,2),
    precio_dia_personalizado DECIMAL(10,2),
    verificacion_estado estado_verificacion DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_perfil_guia_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: idiomas
-- ============================================================
CREATE TABLE idiomas (
    id_idioma SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    nivel nivel_idioma NOT NULL,
    CONSTRAINT fk_idiomas_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: documentos_guia
-- ============================================================
CREATE TABLE documentos_guia (
    id_documento_guia SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL,
    tipo_documento VARCHAR(50),
    archivo_url TEXT,
    estado estado_doc DEFAULT 'pendiente',
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    CONSTRAINT fk_doc_guia_perfil FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE CASCADE,
    CONSTRAINT fk_doc_guia_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: fotos_guia
-- ============================================================
CREATE TABLE fotos_guia (
    id_foto_guia SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL,
    foto_url TEXT,
    descripcion VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aprobado CHAR(1) DEFAULT 'N',
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_fotos_guia_perfil FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: perfil_cliente
-- ============================================================
CREATE TABLE perfil_cliente (
    id_perfil_cliente SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    descripcion VARCHAR(250),
    pais VARCHAR(100),
    ciudad VARCHAR(100),
    imagen_perfil TEXT,
    promedio_calificacion DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_perfil_cliente_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: rango_disponible
-- ============================================================
CREATE TABLE rango_disponible (
    id_rango_disponible SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL,
    hora_inicio TIMESTAMP NOT NULL,
    hora_fin TIMESTAMP NOT NULL,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_rango_perfil_guia FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: politica_reembolso
-- ============================================================
CREATE TABLE politica_reembolso (
    id_politica_reembolso SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),
    porcentaje_reembolso DECIMAL(10,2),
    fecha_limite TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A'
);

-- ============================================================
-- TABLA: reservas
-- ============================================================
CREATE TABLE reservas (
    id_reserva SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL,
    id_perfil_cliente INT NOT NULL,
    lugar VARCHAR(100),
    personas INT,
    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_inicio TIMESTAMP,
    hora_fin TIMESTAMP,
    monto DECIMAL(10,2),
    comision DECIMAL(10,2),
    monto_total DECIMAL(10,2),
    estado_reserva estado_reserva DEFAULT 'Pendiente',
    estado_pago estado_pago DEFAULT 'pendiente',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_reservas_perfil_guia FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE RESTRICT,
    CONSTRAINT fk_reservas_perfil_cliente FOREIGN KEY (id_perfil_cliente) REFERENCES perfil_cliente(id_perfil_cliente) ON DELETE RESTRICT
);

-- ============================================================
-- TABLA: reembolso_reserva
-- ============================================================
CREATE TABLE reembolso_reserva (
    id_reembolso_reserva SERIAL PRIMARY KEY,
    id_reserva INT NOT NULL,
    id_politica_reembolso INT,
    monto DECIMAL(10,2),
    estado_reembolso estado_reembolso DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_reembolso_reserva_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON DELETE CASCADE,
    CONSTRAINT fk_reembolso_reserva_politica FOREIGN KEY (id_politica_reembolso) REFERENCES politica_reembolso(id_politica_reembolso) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: transaccion
-- ============================================================
CREATE TABLE transaccion (
    id_transaccion SERIAL PRIMARY KEY,
    id_reserva INT NOT NULL,
    metodo_pago VARCHAR(100),
    monto_total DECIMAL(10,2),
    comision_guia DECIMAL(10,2),
    comision_cliente DECIMAL(10,2),
    estado_transaccion estado_transaccion DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_transaccion_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON DELETE RESTRICT
);

-- ============================================================
-- TABLA: factura
-- ============================================================
CREATE TABLE factura (
    id_factura SERIAL PRIMARY KEY,
    id_transaccion INT NOT NULL,
    id_perfil_guia INT,
    id_perfil_cliente INT,
    monto_total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_factura_transaccion FOREIGN KEY (id_transaccion) REFERENCES transaccion(id_transaccion) ON DELETE CASCADE,
    CONSTRAINT fk_factura_perfil_guia FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE SET NULL,
    CONSTRAINT fk_factura_perfil_cliente FOREIGN KEY (id_perfil_cliente) REFERENCES perfil_cliente(id_perfil_cliente) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: conversacion
-- ============================================================
CREATE TABLE conversacion (
    id_conversacion SERIAL PRIMARY KEY,
    id_usuario1 INT NOT NULL,
    id_usuario2 INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_conversacion_usuario1 FOREIGN KEY (id_usuario1) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_conversacion_usuario2 FOREIGN KEY (id_usuario2) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: mensaje
-- ============================================================
CREATE TABLE mensaje (
    id_mensaje SERIAL PRIMARY KEY,
    id_conversacion INT NOT NULL,
    id_usuario_sender INT NOT NULL,
    mensaje TEXT,
    media_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_read CHAR(1) DEFAULT 'N',
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_mensaje_conversacion FOREIGN KEY (id_conversacion) REFERENCES conversacion(id_conversacion) ON DELETE CASCADE,
    CONSTRAINT fk_mensaje_usuario_sender FOREIGN KEY (id_usuario_sender) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: notificacion
-- ============================================================
CREATE TABLE notificacion (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo tipo_notificacion,
    titulo VARCHAR(100),
    mensaje TEXT,
    is_read CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_notificacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: resena
-- ============================================================
CREATE TABLE resena (
    id_resena SERIAL PRIMARY KEY,
    id_reserva INT,
    id_perfil_cliente INT,
    id_perfil_guia INT,
    calificacion INT CHECK (calificacion BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_resena_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON DELETE SET NULL,
    CONSTRAINT fk_resena_perfil_cliente FOREIGN KEY (id_perfil_cliente) REFERENCES perfil_cliente(id_perfil_cliente) ON DELETE SET NULL,
    CONSTRAINT fk_resena_perfil_guia FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: respuesta_resena
-- ============================================================
CREATE TABLE respuesta_resena (
    id_respuesta_resena SERIAL PRIMARY KEY,
    id_resena INT NOT NULL,
    id_usuario INT NOT NULL,
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_respuesta_resena_resena FOREIGN KEY (id_resena) REFERENCES resena(id_resena) ON DELETE CASCADE,
    CONSTRAINT fk_respuesta_resena_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: configuracion
-- ============================================================
CREATE TABLE configuracion (
    id_configuracion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    idioma_aplicacion idioma_app DEFAULT 'ES',
    permitir_notificaciones CHAR(1) DEFAULT 'S',
    zona_horaria zona_horaria DEFAULT 'UTC-6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_configuracion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: favorito
-- ============================================================
CREATE TABLE favorito (
    id_favorito SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL,
    id_perfil_cliente INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_favorito_perfil_guia FOREIGN KEY (id_perfil_guia) REFERENCES perfil_guia(id_perfil_guia) ON DELETE CASCADE,
    CONSTRAINT fk_favorito_perfil_cliente FOREIGN KEY (id_perfil_cliente) REFERENCES perfil_cliente(id_perfil_cliente) ON DELETE CASCADE,
    CONSTRAINT uq_favorito UNIQUE (id_perfil_guia, id_perfil_cliente)
);

-- ========================
-- Índices / constraints adicionales (opcionales pero útiles)
-- ========================
-- Por ejemplo, índice para búsquedas de email
CREATE INDEX idx_usuario_email ON usuario(email);

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
