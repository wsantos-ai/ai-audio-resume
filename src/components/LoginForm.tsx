'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useApp } from './AppProvider';
import {
  ArrowRightIcon,
  BarChartIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  LockIcon,
  LogoMark,
  MailIcon,
  StoreIcon,
} from './icons';
import { WaveLines } from './WaveLines';

export function LoginForm() {
  const { user, authReady, setUser } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authReady && user) router.replace('/');
  }, [authReady, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthHero />

        <section className="auth-panel">
          {/* Topo do mobile: marca + onda (o painel azul fica oculto) */}
          <div className="auth-mobile-top">
            <Brand />
            <WaveLines variant="compact" className="auth-mobile-wave" width={420} height={130} />
          </div>

          <div className="auth-content">
            <h1 className="auth-title">Bem-vindo de volta</h1>
            <p className="auth-subtitle">Entre para registrar sua próxima visita.</p>

            <form className="auth-form" onSubmit={submit} noValidate={false}>
              <label className="auth-label" htmlFor="login-email">
                E-mail
              </label>
              <div className="auth-input">
                <MailIcon className="auth-input-icon" size={22} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="voce@empresa.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <label className="auth-label" htmlFor="login-password">
                Senha
              </label>
              <div className="auth-input">
                <LockIcon className="auth-input-icon" size={22} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="•••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOffIcon size={22} /> : <EyeIcon size={22} />}
                </button>
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
                <ArrowRightIcon size={24} strokeWidth={2.2} />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="auth-brand">
      <LogoMark size={36} />
      <span>Resumo de Visitas</span>
    </div>
  );
}

/** Painel azul da esquerda (desktop) */
function AuthHero() {
  return (
    <aside className="auth-hero" aria-hidden="true">
      <Brand />

      <div className="auth-hero-text">
        <h2>
          Sua visita em palavras.
          <br />
          <span>Suas ações organizadas.</span>
        </h2>
        <p>Grave suas impressões e transforme cada visita em um resumo claro.</p>
      </div>

      <svg className="auth-hero-hills" viewBox="0 0 650 300" preserveAspectRatio="none">
        <path d="M0 150 C140 70 260 210 400 150 S580 60 650 90 V300 H0Z" fill="rgba(36, 104, 190, 0.28)" />
        <path d="M0 210 C160 150 300 260 470 210 S610 150 650 170 V300 H0Z" fill="rgba(3, 18, 45, 0.35)" />
      </svg>
      <WaveLines variant="hero" className="auth-hero-wave" />

      <div className="auth-preview">
        <svg className="auth-preview-spark" viewBox="0 0 40 40">
          <path d="M8 20 L16 6" />
          <path d="M14 30 L32 26" />
        </svg>
        <div className="auth-preview-head">
          <div className="auth-preview-icon">
            <StoreIcon size={34} strokeWidth={1.7} />
          </div>
          <div>
            <small>Visita resumida</small>
            <strong>Loja Centro</strong>
          </div>
        </div>
        <ul className="auth-preview-list">
          <li>
            <FileTextIcon size={22} />
            <span>Impressões</span>
            <i />
          </li>
          <li>
            <BarChartIcon size={22} />
            <span>Análises</span>
            <i />
          </li>
          <li>
            <CheckCircleIcon size={22} />
            <span>Próximas ações</span>
            <i />
          </li>
        </ul>
      </div>
    </aside>
  );
}
