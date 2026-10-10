import 'server-only';
import mysql from 'mysql2/promise';
import { config } from './config';

// Reaproveita o pool entre recargas do `next dev` (HMR recria os módulos)
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

export function db(): mysql.Pool {
  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = mysql.createPool({
      ...config.db,
      charset: 'utf8mb4',
      timezone: '-03:00',
      // DATETIME volta como string "YYYY-MM-DD HH:MM:SS", sem conversão de fuso pelo driver
      dateStrings: true,
      connectionLimit: 5,
    });
    globalForDb.mysqlPool.on('connection', (conn) => {
      conn.query("SET time_zone = '-03:00'");
    });
  }
  return globalForDb.mysqlPool;
}
