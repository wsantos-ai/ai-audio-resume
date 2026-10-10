import { handler, json } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { listVisits } from '@/lib/server/visits';

const PER_PAGE = 20;

// GET ?q=&page=: lista de visitas (busca por loja ou gestor)
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = (params.get('q') ?? '').trim().slice(0, 100);
  const visits = await listVisits(user, search, PER_PAGE, (page - 1) * PER_PAGE);
  return json({ visits, per_page: PER_PAGE });
});
