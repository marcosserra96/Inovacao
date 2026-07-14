// Guarda o token de posse do jogador (join_token) devolvido uma única vez
// por join_duel_match. Sem ele, submit_duel_answer/presenter_set_player_connected
// recusam a chamada — é o que impede um participante de agir em nome do
// adversário (cujo id, ao contrário do token, é público no placar).
interface StoredDuelPlayer {
  playerId: string
  joinToken: string
}

function key(matchId: string) {
  return `inovacao:duel:${matchId}`
}

export function saveDuelPlayer(matchId: string, value: StoredDuelPlayer) {
  localStorage.setItem(key(matchId), JSON.stringify(value))
}

export function loadDuelPlayer(matchId: string): StoredDuelPlayer | null {
  const raw = localStorage.getItem(key(matchId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredDuelPlayer
  } catch {
    return null
  }
}
