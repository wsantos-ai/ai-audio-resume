import 'server-only';
import mysql from 'mysql2/promise';
import { config } from './config';

// Reaproveita o pool entre recargas do `next dev` (HMR recria os módulos). Guarda junto as credenciais usadas:
// se o .env mudar com o servidor rodando, o pool antigo é descartado em vez de continuar com a senha velha.
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool; mysqlPoolKey?: string };

export function db(): mysql.Pool {
  const settings = config.db;
  const key = JSON.stringify(settings);
  if (globalForDb.mysqlPool && globalForDb.mysqlPoolKey !== key) {
    globalForDb.mysqlPool.end().catch(() => {});
    globalForDb.mysqlPool = undefined;
  }
  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = mysql.createPool({
      ...settings,
      charset: 'utf8mb4',
      timezone: '-03:00',
      // DATETIME volta como string "YYYY-MM-DD HH:MM:SS", sem conversão de fuso pelo driver
      dateStrings: true,
      connectionLimit: 5,
    });
    globalForDb.mysqlPool.on('connection', (conn) => {
      conn.query("SET time_zone = '-03:00'");
    });
    globalForDb.mysqlPoolKey = key;
  }
  return globalForDb.mysqlPool;
}
