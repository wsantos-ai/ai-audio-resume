export function formatDuration(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Aceita ISO ou "YYYY-MM-DD HH:MM:SS" (horário local vindo do banco). */
export function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
