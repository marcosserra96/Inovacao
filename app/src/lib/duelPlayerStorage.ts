// Guarda o token de posse do jogador (join_token) devolvido uma única vez
// por join_duel_match. Sem ele, submit_duel_answer/presenter_set_player_connected
// recusam a chamada — é o que impede um participante de agir em nome do
// adversário (cujo id, ao contrário do token, é público no placar).
interface StoredDuelPlayer {
  playerId: string
  joinToken: string
}

// A chave inclui o playerId (não só o matchId): se dois participantes
// entrarem na mesma partida a partir do mesmo navegador/dispositivo
// (ex.: testes, ou um celular compartilhado), o segundo não pode apagar
// o token do primeiro.
function key(matchId: string, playerId: string) {
  return `inovacao:duel:${matchId}:${playerId}`
}

export function saveDuelPlayer(matchId: string, value: StoredDuelPlayer) {
  localStorage.setItem(key(matchId, value.playerId), JSON.stringify(value))
}

export function loadDuelPlayer(matchId: string, playerId: string): StoredDuelPlayer | null {
  const raw = localStorage.getItem(key(matchId, playerId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredDuelPlayer
  } catch {
    return null
  }
}
