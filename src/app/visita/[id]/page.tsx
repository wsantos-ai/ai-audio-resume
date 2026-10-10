import { notFound } from 'next/navigation';
import { VisitReview } from '@/components/VisitReview';

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <VisitReview id={id} />;
}
