import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { db } from '@/lib/server/db';
import { assertFetchRequest, handler, HttpError, json } from '@/lib/server/http';
import { getSession, requireUser } from '@/lib/server/session';

// GET: usuário logado | POST {email, password}: login | DELETE: logout

export const GET = handler(async () => json({ user: await requireUser() }));

export const POST = handler(async (request: Request) => {
  assertFetchRequest(request);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const [rows] = await db().query<RowDataPacket[]>(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ? AND active = 1',
    [email],
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    await new Promise((r) => setTimeout(r, 1000)); // atrasa tentativas de força bruta
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const session = await getSession();
  session.userId = Number(row.id);
  await session.save();

  return json({ user: { id: Number(row.id), name: row.name, email: row.email, role: row.role } });
});

export const DELETE = handler(async (request: Request) => {
  assertFetchRequest(request);
  (await getSession()).destroy();
  return json({ ok: true });
});
