import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Não lança erro aqui: isso derrubaria toda a árvore React (tela branca)
  // já que o cliente é importado por contextos globais (Auth/Theme). Em vez
  // disso, um cliente "de mentira" é criado para que a UI continue
  // renderizável — cada chamada de rede vai falhar e ser tratada pelo
  // estado de erro de cada tela. <ConfigWarningBanner> avisa o operador.
  console.warn(
    'Supabase não configurado: copie .env.example para .env e preencha VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

const REQUEST_TIMEOUT_MS = 12000

// Sem isso, uma queda de rede/Wi-Fi durante o evento deixaria qualquer
// tela presa em "carregando…" para sempre — o fetch nunca rejeitaria e o
// estado de erro de cada tela nunca seria acionado. O timeout garante que
// toda chamada eventualmente falha de forma visível, permitindo mostrar
// "não foi possível carregar — tentar novamente" (seção 12 do briefing).
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(input, { ...init, signal: init?.signal ?? controller.signal }).finally(() => clearTimeout(timeout))
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      fetch: fetchWithTimeout,
    },
  },
)
