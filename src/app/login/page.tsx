import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = { title: 'Entrar · Resumo de Visitas' };

export default function LoginPage() {
  return <LoginForm />;
}
