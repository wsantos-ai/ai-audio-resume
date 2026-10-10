import 'server-only';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from './db';
import type { AiSummary } from './prompts';
import type { User, Visit, VisitAction, VisitListItem, VisitSummary, VisitUpdate } from '@/lib/types';

// Acesso às tabelas visits / visit_actions. Avaliador só enxerga as próprias visitas; admin enxerga todas.
// Use aspas simples em literais SQL (aspas duplas quebram com ANSI_QUOTES).

export async function findIdByClientUuid(userId: number, uuid: string): Promise<number | null> {
  const [rows] = await db().query<RowDataPacket[]>('SELECT id FROM visits WHERE user_id = ? AND client_uuid = ?', [
    userId,
    uuid,
  ]);
  return rows[0] ? Number(rows[0].id) : null;
}

export async function countRecent(userId: number, minutes: number): Promise<number> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM visits WHERE user_id = ? AND created_at > NOW() - INTERVAL ? MINUTE',
    [userId, minutes],
  );
  return Number(rows[0].total);
}

export async function createProcessing(userId: number, uuid: string, visitedAt: string, seconds: number | null) {
  const [result] = await db().query<ResultSetHeader>(
    "INSERT INTO visits (user_id, client_uuid, visited_at, audio_seconds, status) VALUES (?, ?, ?, ?, 'processing')",
    [userId, uuid, visitedAt, seconds],
  );
  return result.insertId;
}

/** Reaproveita um registro com erro (ou travado) para nova tentativa com o mesmo client_uuid. */
export async function resetForRetry(id: number) {
  await db().query(
    "UPDATE visits SET status = 'processing', error_message = NULL, updated_at = NOW() WHERE id = ?",
    [id],
  );
}

export async function markError(id: number, message: string) {
  await db().query("UPDATE visits SET status = 'error', error_message = ? WHERE id = ?", [message.slice(0, 500), id]);
}

export async function saveTranscript(id: number, transcript: string, model: string) {
  await db().query('UPDATE visits SET transcript = ?, model_transcription = ? WHERE id = ?', [transcript, model, id]);
}

/** Grava o JSON vindo da IA e muda o status para draft. */
export async function saveSummary(id: number, summary: AiSummary, model: string) {
  await transaction(async (conn) => {
    await conn.query(
      "UPDATE visits SET store_name = ?, manager_name = ?, summary_json = ?, model_summary = ?, status = 'draft' WHERE id = ?",
      [
        nullIfEmpty(summary.loja),
        nullIfEmpty(summary.gestor),
        encodeSummary({ resumo: summary.resumo, impressoes: summary.impressoes, analises: summary.analises }),
        model,
        id,
      ],
    );
    const actions = (summary.acoes ?? []).map((a) => ({
      description: a.descricao,
      owner: a.responsavel,
      due: a.prazo,
      done: false,
    }));
    await replaceActions(conn, id, actions);
  });
}

/** Atualização feita pelo usuário na tela de revisão. */
export async function updateVisit(id: number, data: Partial<VisitUpdate>) {
  await transaction(async (conn) => {
    await conn.query(
      'UPDATE visits SET store_name = ?, manager_name = ?, visited_at = ?, summary_json = ?, status = ? WHERE id = ?',
      [
        nullIfEmpty(data.store_name),
        nullIfEmpty(data.manager_name),
        normalizeDate(data.visited_at),
        encodeSummary(data.summary),
        data.status === 'confirmed' ? 'confirmed' : 'draft',
        id,
      ],
    );
    await replaceActions(conn, id, Array.isArray(data.actions) ? data.actions : []);
  });
}

export async function findVisit(id: number, user: User): Promise<Visit | null> {
  let sql = 'SELECT v.*, u.name AS user_name FROM visits v JOIN users u ON u.id = v.user_id WHERE v.id = ?';
  const params: unknown[] = [id];
  if (user.role !== 'admin') {
    sql += ' AND v.user_id = ?';
    params.push(user.id);
  }
  const [rows] = await db().query<RowDataPacket[]>(sql, params);
  if (!rows[0]) return null;

  const [actionRows] = await db().query<RowDataPacket[]>(
    'SELECT id, description, owner, due, done FROM visit_actions WHERE visit_id = ? ORDER BY position',
    [id],
  );
  const actions: VisitAction[] = actionRows.map((a) => ({
    id: Number(a.id),
    description: a.description,
    owner: a.owner ?? '',
    due: a.due ?? '',
    done: Boolean(a.done),
  }));

  return { ...format(rows[0]), transcript: rows[0].transcript ?? '', actions };
}

export async function listVisits(user: User, search: string, limit: number, offset: number): Promise<VisitListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (user.role !== 'admin') {
    where.push('v.user_id = ?');
    params.push(user.id);
  }
  if (search) {
    where.push('(v.store_name LIKE ? OR v.manager_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const sql = `SELECT v.*, u.name AS user_name,
                      (SELECT COUNT(*) FROM visit_actions a WHERE a.visit_id = v.id AND a.done = 0) AS open_actions
                 FROM visits v JOIN users u ON u.id = v.user_id
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY v.visited_at DESC
                LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;
  const [rows] = await db().query<RowDataPacket[]>(sql, params);
  return rows.map((row) => ({ ...format(row), open_actions: Number(row.open_actions) }));
}

function format(row: RowDataPacket): VisitListItem {
  let summary: VisitSummary = { resumo: '', impressoes: [], analises: [] };
  try {
    if (row.summary_json) summary = JSON.parse(row.summary_json);
  } catch {}
  return {
    id: Number(row.id),
    client_uuid: row.client_uuid,
    user_name: row.user_name,
    store_name: row.store_name ?? '',
    manager_name: row.manager_name ?? '',
    visited_at: row.visited_at,
    audio_seconds: row.audio_seconds !== null ? Number(row.audio_seconds) : null,
    status: row.status,
    error_message: row.error_message,
    updated_at: row.updated_at,
    summary,
  };
}

async function replaceActions(conn: PoolConnection, visitId: number, actions: Partial<VisitAction>[]) {
  await conn.query('DELETE FROM visit_actions WHERE visit_id = ?', [visitId]);
  let position = 0;
  for (const action of actions) {
    const description = String(action.description ?? '').trim();
    if (!description) continue;
    await conn.query(
      'INSERT INTO visit_actions (visit_id, position, description, owner, due, done) VALUES (?, ?, ?, ?, ?, ?)',
      [visitId, position++, description, nullIfEmpty(action.owner), nullIfEmpty(action.due, 100), action.done ? 1 : 0],
    );
  }
}

async function transaction(fn: (conn: PoolConnection) => Promise<void>) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await fn(conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function encodeSummary(summary?: Partial<VisitSummary>): string {
  const clean = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter((s) => s !== '');
  return JSON.stringify({
    resumo: String(summary?.resumo ?? '').trim(),
    impressoes: clean(summary?.impressoes),
    analises: clean(summary?.analises),
  });
}

function nullIfEmpty(value: unknown, maxLength = 190): string | null {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

const saoPauloFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Converte para "YYYY-MM-DD HH:MM:SS" no horário de Brasília.
 * Aceita ISO com fuso (gravação, vinda do navegador) ou "YYYY-MM-DDTHH:MM" sem fuso (input datetime-local,
 * já em horário local).
 */
export function normalizeDate(value?: string): string {
  const local = value?.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (local) return `${local[1]} ${local[2]}${local[3] ?? ':00'}`;
  const date = value ? new Date(value) : new Date();
  return saoPauloFormat.format(isNaN(date.getTime()) ? new Date() : date);
}
