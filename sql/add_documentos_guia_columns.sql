-- Script para agregar columnas faltantes a la tabla documentos_guia
-- Estas columnas son necesarias para el sistema de verificación de documentos del panel admin

-- Agregar columna estado (pendiente, aprobado, rechazado)
ALTER TABLE documentos_guia 
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente';

-- Agregar columna reviewed_by (id del admin que revisó)
ALTER TABLE documentos_guia 
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;

-- Agregar columna reviewed_at (fecha de revisión)
ALTER TABLE documentos_guia 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Agregar columna created_at si no existe
ALTER TABLE documentos_guia 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Opcional: Agregar clave foránea para reviewed_by
-- ALTER TABLE documentos_guia 
-- ADD CONSTRAINT fk_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES usuario(id_usuario);

-- Actualizar documentos existentes a estado 'pendiente' si están NULL
UPDATE documentos_guia SET estado = 'pendiente' WHERE estado IS NULL;
