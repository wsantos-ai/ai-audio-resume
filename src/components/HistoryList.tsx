'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { formatDate } from '@/lib/client/format';
import { STATUS_LABELS, type VisitListItem } from '@/lib/types';
import { useApp } from './AppProvider';

export function HistoryList() {
  const { user, toast } = useApp();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const data = await api.listVisits(query, page);
      setVisits((prev) => (page === 1 ? data.visits : [...prev, ...data.visits]));
      setHasMore(data.visits.length === data.per_page);
      setLoaded(true);
    } catch (err) {
      toast((err as Error).message);
    }
  }, [query, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card">
      <input
        type="search"
        placeholder="Buscar por loja ou gestor"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="list">
        {loaded && visits.length === 0 && <li className="empty">Nenhuma visita encontrada.</li>}
        {visits.map((v) => (
          <li key={v.id}>
            <Link href={`/visita/${v.id}`} className="history-item">
              <strong>{v.store_name || '(loja não identificada)'}</strong>
              <small>
                {[formatDate(v.visited_at), v.manager_name && `Gestor: ${v.manager_name}`, user?.role === 'admin' && v.user_name]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
              {!!v.open_actions && <small>{v.open_actions} ação(ões) em aberto</small>}
            </Link>
            <span className={`badge ${v.status}`}>{STATUS_LABELS[v.status]}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" className="btn small" onClick={() => setPage(page + 1)}>
          Carregar mais
        </button>
      )}
    </div>
  );
}
