// Formatos retornados pelas funções RPC (build_question_payload e afins) —
// compartilhados entre o modo individual e o modo duelo.
export interface QuestionOption {
  optionId: string
  text: string
  isCorrect: boolean | null
}

export interface QuestionPayload {
  questionId: string
  statement: string
  type: string
  mediaUrl: string | null
  timeLimitSeconds: number
  explanation: string | null
  options: QuestionOption[]
}
