// Persiste a participação do usuário no navegador (localStorage) para que
// atualizar a página (F5) ou perder a conexão não perca o progresso — o
// servidor continua sendo a fonte de verdade da pontuação e do avanço.
interface StoredAttempt {
  attemptId: string
  participantId: string
  displayName: string
}

function key(sessionId: string) {
  return `inovacao:attempt:${sessionId}`
}

export function saveAttempt(sessionId: string, attempt: StoredAttempt) {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(attempt))
  } catch {
    // Alguns navegadores móveis/modos privados bloqueiam storage.
    // A sessão continua funcionando; apenas a restauração após F5 fica indisponível.
  }
}

export function loadAttempt(sessionId: string): StoredAttempt | null {
  try {
    const raw = localStorage.getItem(key(sessionId))
    if (!raw) return null
    return JSON.parse(raw) as StoredAttempt
  } catch {
    return null
  }
}

export function clearAttempt(sessionId: string) {
  try {
    localStorage.removeItem(key(sessionId))
  } catch {
    // Sem storage disponível, não há nada persistido para limpar.
  }
}

let volatileDeviceId: string | null = null

function createDeviceId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fallback abaixo
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

// Identificador estável do dispositivo, usado apenas como sinal auxiliar
// para impedir múltiplas participações quando allow_retry está desabilitado.
// Nunca deve impedir a entrada caso o navegador bloqueie localStorage.
export function getDeviceFingerprint(): string {
  const storageKey = 'inovacao:device'

  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) return stored

    const created = createDeviceId()
    localStorage.setItem(storageKey, created)
    return created
  } catch {
    if (!volatileDeviceId) volatileDeviceId = createDeviceId()
    return volatileDeviceId
  }
}
