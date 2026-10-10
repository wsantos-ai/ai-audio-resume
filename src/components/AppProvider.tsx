'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, AUTH_REQUIRED_EVENT } from '@/lib/client/api';
import { queue, type PendingRecording } from '@/lib/client/queue';
import type { User } from '@/lib/types';

// Estado global do app: usuário, toast e a fila de gravações pendentes (envio, reenvio quando volta a internet).

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  setUser: (user: User | null) => void;
  online: boolean;
  toast: (message: string) => void;
  toastMessage: string | null;
  pending: PendingRecording[];
  sending: string[];
  enqueue: (item: PendingRecording) => Promise<void>;
  sendItem: (item: PendingRecording, options?: { openResult?: boolean }) => Promise<void>;
  discard: (uuid: string) => Promise<void>;
  recording: boolean;
  setRecording: (recording: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>.');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [sending, setSending] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const sendingRef = useRef(new Set<string>());
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    try {
      if (next) localStorage.setItem('user', JSON.stringify(next));
      else localStorage.removeItem('user');
    } catch {}
  }, []);

  const refreshPending = useCallback(async () => setPending(await queue.all()), []);

  const sendItem = useCallback(
    async (item: PendingRecording, { openResult = false } = {}) => {
      if (sendingRef.current.has(item.uuid)) return;
      if (!navigator.onLine) {
        toast('Sem internet. A gravação será enviada quando a conexão voltar.');
        return refreshPending();
      }
      sendingRef.current.add(item.uuid);
      setSending([...sendingRef.current]);
      try {
        const { visit } = await api.process(item);
        if (visit.status === 'processing') {
          // Uma requisição anterior ainda está processando este áudio; mantém na fila até concluir
          await queue.put({ ...item, lastError: 'Ainda em processamento no servidor.' });
        } else {
          await queue.remove(item.uuid);
          if (openResult) router.push(`/visita/${visit.id}`);
          else toast(`Visita "${visit.store_name || 'sem nome'}" processada.`);
        }
      } catch (err) {
        const error = err as ApiError;
        await queue.put({ ...item, lastError: error.message });
        toast(error.retryable ? `${error.message} A gravação ficou salva para reenvio.` : error.message);
      } finally {
        sendingRef.current.delete(item.uuid);
        setSending([...sendingRef.current]);
        await refreshPending();
      }
    },
    [refreshPending, router, toast],
  );

  const sendPending = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const item of await queue.all()) await sendItem(item);
  }, [sendItem]);

  const enqueue = useCallback(
    async (item: PendingRecording) => {
      await queue.put(item); // salva antes de enviar: nada se perde se a rede cair
      await refreshPending();
      await sendItem(item, { openResult: true });
    },
    [refreshPending, sendItem],
  );

  const discard = useCallback(
    async (uuid: string) => {
      await queue.remove(uuid);
      await refreshPending();
    },
    [refreshPending],
  );

  // Service Worker, armazenamento persistente e verificação da sessão
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js');
      } else {
        // Em dev os arquivos de /_next/static/ não têm hash: o cache-first do SW serviria JS desatualizado
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
        caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
    navigator.storage?.persist?.(); // evita que o navegador apague a fila offline
    setOnline(navigator.onLine);
    refreshPending();

    api
      .me()
      .then(({ user }) => setUser(user))
      .catch((err: ApiError) => {
        // Sem rede: libera a gravação com o último usuário conhecido; o envio fica na fila
        let cached: User | null = null;
        try {
          cached = err.status === 0 ? JSON.parse(localStorage.getItem('user') ?? 'null') : null;
        } catch {}
        setUser(cached);
      })
      .finally(() => setAuthReady(true));
  }, [refreshPending, setUser]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      sendPending();
    };
    const onOffline = () => setOnline(false);
    const onAuthRequired = () => setUser(null);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    };
  }, [sendPending, setUser]);

  // Ao logar (ou abrir o app logado), tenta enviar o que ficou na fila
  useEffect(() => {
    if (user) sendPending();
  }, [user, sendPending]);

  return (
    <AppContext.Provider
      value={{
        user,
        authReady,
        setUser,
        online,
        toast,
        toastMessage,
        pending,
        sending,
        enqueue,
        sendItem,
        discard,
        recording,
        setRecording,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
