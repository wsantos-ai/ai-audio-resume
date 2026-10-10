import type { Metadata } from 'next';
import { HistoryList } from '@/components/HistoryList';

export const metadata: Metadata = { title: 'Histórico · Resumo de Visitas' };

export default function HistoryPage() {
  return <HistoryList />;
}
