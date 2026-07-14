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
  localStorage.setItem(key(sessionId), JSON.stringify(attempt))
}

export function loadAttempt(sessionId: string): StoredAttempt | null {
  const raw = localStorage.getItem(key(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredAttempt
  } catch {
    return null
  }
}

export function clearAttempt(sessionId: string) {
  localStorage.removeItem(key(sessionId))
}

// Identificador estável do dispositivo, usado apenas como sinal auxiliar
// para impedir múltiplas participações quando allow_retry está desabilitado.
export function getDeviceFingerprint(): string {
  const storageKey = 'inovacao:device'
  let id = localStorage.getItem(storageKey)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(storageKey, id)
  }
  return id
}
