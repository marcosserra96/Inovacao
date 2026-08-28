// Guarda o token de posse do participante (join_token) devolvido uma única
// vez por join_live_quiz. O armazenamento local é preferido, mas pode ser
// bloqueado por alguns navegadores móveis/modos de privacidade — por isso
// todas as leituras/escritas são tolerantes a falhas.
interface StoredLiveQuizParticipant {
  participantId: string
  joinToken: string
}

function key(sessionId: string, participantId: string) {
  return `inovacao:live-quiz:${sessionId}:${participantId}`
}

export function saveLiveQuizParticipant(sessionId: string, value: StoredLiveQuizParticipant) {
  try {
    localStorage.setItem(key(sessionId, value.participantId), JSON.stringify(value))
  } catch {
    // O fluxo atual ainda segue via navigation state mesmo sem localStorage.
  }
}

export function loadLiveQuizParticipant(sessionId: string, participantId: string): StoredLiveQuizParticipant | null {
  try {
    const raw = localStorage.getItem(key(sessionId, participantId))
    if (!raw) return null
    return JSON.parse(raw) as StoredLiveQuizParticipant
  } catch {
    return null
  }
}

export { getDeviceFingerprint as getLiveQuizDeviceFingerprint } from './individualAttemptStorage'
