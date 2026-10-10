-- Schema do Resumo de Visitas (MySQL 8 / MariaDB 10.6+)
-- Importar pelo phpMyAdmin do hPanel ou: mysql -u USER -p DB < database/schema.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('avaliador', 'admin') NOT NULL DEFAULT 'avaliador',
    active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visits (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    -- UUID gerado no navegador; torna o reenvio da fila offline idempotente
    client_uuid         CHAR(36) NOT NULL,
    store_name          VARCHAR(190) NULL,
    manager_name        VARCHAR(190) NULL,
    visited_at          DATETIME NOT NULL,
    audio_seconds       INT UNSIGNED NULL,
    transcript          MEDIUMTEXT NULL,
    -- {"resumo": "...", "impressoes": [...], "analises": [...]}
    summary_json        LONGTEXT NULL,
    -- processing -> draft (gerado pela IA) -> confirmed (revisado pelo usuário); error se a IA falhar
    status              ENUM('processing', 'draft', 'confirmed', 'error') NOT NULL DEFAULT 'processing',
    error_message       VARCHAR(500) NULL,
    model_transcription VARCHAR(100) NULL,
    model_summary       VARCHAR(100) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_visits_client (user_id, client_uuid),
    KEY idx_visits_user_date (user_id, visited_at),
    KEY idx_visits_store (store_name),
    CONSTRAINT fk_visits_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visit_actions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visit_id    INT UNSIGNED NOT NULL,
    position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    owner       VARCHAR(190) NULL,
    -- texto livre: o áudio costuma trazer prazos como "até sexta" ou "próxima visita"
    due         VARCHAR(100) NULL,
    done        TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_actions_visit (visit_id, position),
    CONSTRAINT fk_actions_visit FOREIGN KEY (visit_id) REFERENCES visits (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
