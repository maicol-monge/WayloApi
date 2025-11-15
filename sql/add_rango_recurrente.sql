-- Tabla de horarios recurrentes por día de la semana
-- Ejecutar después de crear rango_disponible
CREATE TABLE IF NOT EXISTS rango_recurrente (
    id_recurrente SERIAL PRIMARY KEY,
    id_perfil_guia INT NOT NULL REFERENCES perfil_guia(id_perfil_guia) ON DELETE CASCADE,
    weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1=Dom .. 7=Sab
    habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rango_recurrente_perfil ON rango_recurrente(id_perfil_guia);
CREATE INDEX IF NOT EXISTS idx_rango_recurrente_weekday ON rango_recurrente(weekday);
