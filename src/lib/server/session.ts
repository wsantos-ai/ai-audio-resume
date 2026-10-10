import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import type { RowDataPacket } from 'mysql2';
import { config } from './config';
import { db } from './db';
import { HttpError } from './http';
import type { User } from '@/lib/types';

interface SessionData {
  userId?: number;
}

/** Sessão em cookie criptografado (iron-session); o usuário é revalidado no banco a cada requisição. */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: config.sessionSecret,
    cookieName: 'visitas_session',
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: { secure: config.isProduction, httpOnly: true, sameSite: 'lax', path: '/' },
  });
}

export async function findActiveUser(id: number): Promise<User | null> {
  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT id, name, email, role FROM users WHERE id = ? AND active = 1',
    [id],
  );
  return (rows[0] as User | undefined) ?? null;
}

/** Retorna o usuário logado ou lança 401. */
export async function requireUser(): Promise<User> {
  const session = await getSession();
  const user = session.userId ? await findActiveUser(session.userId) : null;
  if (!user) throw new HttpError(401, 'Não autenticado.');
  return user;
}
