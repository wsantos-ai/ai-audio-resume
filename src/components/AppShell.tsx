'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useApp } from './AppProvider';
import { LogoMark } from './icons';

/** Barra superior, navegação inferior, toast e proteção das telas que exigem login. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, authReady, setUser, online, toastMessage, recording } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (authReady && !user && !isLogin) router.replace('/login');
  }, [authReady, user, isLogin, router]);

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  const toast = toastMessage && (
    <div className="toast" role="status">
      {toastMessage}
    </div>
  );

  // O login tem layout próprio, em tela cheia (sem barra superior e navegação)
  if (isLogin) {
    return (
      <>
        {children}
        {toast}
      </>
    );
  }

  const canRender = authReady && user;

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <LogoMark size={26} />
          <h1>Resumo de Visitas</h1>
        </div>
        {user && (
          <div className="topbar-user">
            <span>{user.name}</span>
            <button type="button" className="link" onClick={logout} disabled={recording}>
              Sair
            </button>
          </div>
        )}
      </header>

      {!online && (
        <div className="offline-banner">Sem internet — as gravações ficam salvas e serão enviadas depois.</div>
      )}

      <main>{canRender ? children : null}</main>

      {user && !recording && (
        <nav className="tabbar">
          <Link href="/" className={pathname === '/' ? 'active' : ''}>
            Gravar
          </Link>
          <Link href="/historico" className={pathname.startsWith('/historico') ? 'active' : ''}>
            Histórico
          </Link>
        </nav>
      )}

      {toast}
    </>
  );
}
