// Guarda o token de posse do participante (join_token) devolvido uma única
// vez por join_live_quiz. Sem ele, submit_live_quiz_answer recusa a
// chamada — é o que impede alguém de responder em nome de outro
// participante (cujo id, ao contrário do token, é público no placar).
//
// A chave inclui o participantId (não só o sessionId): se o mesmo
// navegador/dispositivo entrar duas vezes na mesma sessão (testes, ou um
// celular compartilhado), a segunda não apaga o token da primeira.
interface StoredLiveQuizParticipant {
  participantId: string
  joinToken: string
}

function key(sessionId: string, participantId: string) {
  return `inovacao:live-quiz:${sessionId}:${participantId}`
}

export function saveLiveQuizParticipant(sessionId: string, value: StoredLiveQuizParticipant) {
  localStorage.setItem(key(sessionId, value.participantId), JSON.stringify(value))
}

export function loadLiveQuizParticipant(sessionId: string, participantId: string): StoredLiveQuizParticipant | null {
  const raw = localStorage.getItem(key(sessionId, participantId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredLiveQuizParticipant
  } catch {
    return null
  }
}

// O device fingerprint é o mesmo do modo individual (identifica o
// navegador, não o modo de jogo) — reaproveitado aqui para restaurar a
// participação automaticamente num F5 ou ao fechar/abrir a aba de novo.
export { getDeviceFingerprint as getLiveQuizDeviceFingerprint } from './individualAttemptStorage'
