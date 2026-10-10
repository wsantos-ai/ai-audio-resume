import { assertFetchRequest, handler, HttpError, json } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { findVisit, updateVisit } from '@/lib/server/visits';

type Context = { params: Promise<{ id: string }> };

async function loadVisit(context: Context) {
  const user = await requireUser();
  const { id } = await context.params;
  const visit = await findVisit(Number(id), user);
  if (!visit) throw new HttpError(404, 'Visita não encontrada.');
  return { user, visit };
}

export const GET = handler(async (_request: Request, context: Context) => {
  const { visit } = await loadVisit(context);
  return json({ visit });
});

// PUT: salva a revisão feita pelo usuário (rascunho ou confirmação)
export const PUT = handler(async (request: Request, context: Context) => {
  assertFetchRequest(request);
  const { user, visit } = await loadVisit(context);
  if (visit.status === 'processing') throw new HttpError(409, 'A visita ainda está sendo processada.');
  await updateVisit(visit.id, await request.json().catch(() => ({})));
  return json({ visit: await findVisit(visit.id, user) });
});
