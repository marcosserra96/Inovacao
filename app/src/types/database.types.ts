// Tipos do schema Supabase, escritos a mão a partir das migrations em
// supabase/migrations (validadas localmente — ver Fase 2 do plano). Caso
// o Supabase CLI com Docker esteja disponível no futuro, este arquivo pode
// ser regerado com:
//   supabase gen types typescript --project-id <id> > src/types/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AdminRole = 'admin' | 'presenter'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type QuestionType = 'single_choice' | 'true_false' | 'multiple_choice' | 'image' | 'poll' | 'tiebreaker'
export type QuestionStatus = 'active' | 'inactive' | 'archived'
export type GameMode = 'individual' | 'duel' | 'live_quiz'
export type QuestionOrderMode = 'fixed' | 'random'
export type IndividualSessionStatus = 'draft' | 'scheduled' | 'open' | 'closed'
export type DuelMatchStatus = 'draft' | 'lobby' | 'in_progress' | 'finished' | 'cancelled'
export type DuelRoundsMode = 'fixed_count' | 'best_of' | 'free'
export type DuelWinCondition = 'score' | 'correct_count'
export type DuelPhase =
  | 'waiting_players'
  | 'players_connected'
  | 'ready'
  | 'question_shown'
  | 'awaiting_answers'
  | 'answers_received'
  | 'time_up'
  | 'result_revealed'
  | 'match_ended'
export type LiveQuizPhase =
  | 'lobby'
  | 'rules'
  | 'ready'
  | 'question_shown'
  | 'awaiting_answers'
  | 'time_up'
  | 'result_revealed'
  | 'ranking'
  | 'tiebreaker_question'
  | 'tiebreaker_answering'
  | 'tiebreaker_reveal'
  | 'finalists_reveal'
  | 'duel_ready'
  | 'quiz_finished'
  | 'duel_semifinals'
  | 'duel_final'

export interface Database {
  public: {
    Tables: {
      admin_profiles: {
        Row: { user_id: string; role: AdminRole; name: string; created_at: string }
        Insert: { user_id: string; role?: AdminRole; name: string }
        Update: Partial<{ role: AdminRole; name: string }>
        Relationships: []
      }
      event_settings: {
        Row: {
          id: boolean
          event_name: string
          dynamic_name: string
          primary_color: string
          secondary_color: string
          accent_color: string
          logo_url: string | null
          background_url: string | null
          welcome_message: string
          result_message: string
          updated_at: string
        }
        Insert: never
        Update: Partial<Omit<Database['public']['Tables']['event_settings']['Row'], 'id' | 'updated_at'>>
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string }
        Update: Partial<{ name: string }>
        Relationships: []
      }
      scoring_configs: {
        Row: {
          id: string
          name: string
          speed_bonus_max: number
          enable_streak_bonus: boolean
          streak_bonus: number
          streak_bonus_cap: number
          enable_penalty: boolean
          penalty_wrong: number
          tie_break_rules: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['scoring_configs']['Row'], 'id' | 'created_at' | 'updated_at'>> & {
          name: string
        }
        Update: Partial<Database['public']['Tables']['scoring_configs']['Row']>
        Relationships: []
      }
      question_sets: {
        Row: { id: string; name: string; description: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; description?: string | null }
        Update: Partial<{ name: string; description: string | null }>
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          statement: string
          category_id: string | null
          difficulty: QuestionDifficulty
          type: QuestionType
          time_limit_seconds: number
          base_points: number
          media_url: string | null
          explanation: string | null
          status: QuestionStatus
          modes: GameMode[]
          tags: string[]
          is_demo: boolean
          author_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['questions']['Row'], 'id' | 'created_at' | 'updated_at'>> & {
          statement: string
        }
        Update: Partial<Database['public']['Tables']['questions']['Row']>
        Relationships: []
      }
      question_options: {
        Row: { id: string; question_id: string; text: string; is_correct: boolean; position: number }
        Insert: { id?: string; question_id: string; text: string; is_correct?: boolean; position?: number }
        Update: Partial<{ text: string; is_correct: boolean; position: number }>
        Relationships: [
          {
            foreignKeyName: 'question_options_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
        ]
      }
      question_set_items: {
        Row: { question_set_id: string; question_id: string; position: number }
        Insert: { question_set_id: string; question_id: string; position?: number }
        Update: Partial<{ position: number }>
        Relationships: []
      }
      individual_sessions: {
        Row: {
          id: string
          name: string
          code: string
          question_set_id: string
          scoring_config_id: string
          opens_at: string | null
          closes_at: string | null
          question_count: number
          question_order: QuestionOrderMode
          shuffle_options: boolean
          time_limit_seconds: number | null
          allow_retry: boolean
          require_identification: boolean
          show_correct_answer: boolean
          show_ranking: boolean
          ranking_size: number
          status: IndividualSessionStatus
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['individual_sessions']['Row'], 'id' | 'code' | 'created_at' | 'updated_at'>> & {
          name: string
          question_set_id: string
          scoring_config_id: string
        }
        Update: Partial<Database['public']['Tables']['individual_sessions']['Row']>
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          session_id: string
          display_name: string
          team: string | null
          device_fingerprint: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      individual_attempts: {
        Row: {
          id: string
          session_id: string
          participant_id: string
          question_ids: string[]
          option_order: Json
          current_index: number
          current_question_started_at: string | null
          started_at: string
          finished_at: string | null
          total_score: number
          correct_count: number
          total_time_ms: number
          status: 'in_progress' | 'finished' | 'abandoned'
        }
        Insert: never
        Update: never
        Relationships: []
      }
      individual_answers: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          option_id: string | null
          is_correct: boolean
          is_late: boolean
          answer_time_ms: number
          points_awarded: number
          answered_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      duel_matches: {
        Row: {
          id: string
          code: string
          name: string | null
          question_set_id: string
          scoring_config_id: string
          rounds_total: number
          rounds_mode: DuelRoundsMode
          win_condition: DuelWinCondition
          same_time_for_both: boolean
          end_on_both_answered: boolean
          enable_speed_bonus: boolean
          enable_penalty: boolean
          penalty_wrong: number
          phase: DuelPhase
          current_round_number: number
          presenter_id: string | null
          screen_message: string | null
          locked: boolean
          winner_player_id: string | null
          paired_match_id: string | null
          started_at: string | null
          ended_at: string | null
          status: DuelMatchStatus
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      duel_players: {
        Row: {
          id: string
          match_id: string
          display_name: string
          avatar_color: string
          is_active_disputant: boolean
          connected: boolean
          total_score: number
          correct_count: number
          joined_at: string
          left_at: string | null
          promoted_from_live_quiz_participant_id: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      duel_rounds: {
        Row: {
          id: string
          match_id: string
          round_number: number
          question_id: string | null
          phase: DuelPhase
          timer_started_at: string | null
          timer_duration_seconds: number
          timer_paused_at: string | null
          timer_accumulated_ms: number
          revealed_at: string | null
          voided: boolean
          winner_player_id: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      duel_answers: {
        Row: {
          id: string
          round_id: string
          player_id: string
          option_id: string | null
          is_correct: boolean
          is_late: boolean
          response_time_ms: number | null
          points_awarded: number
          answered_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      duel_answer_flags: {
        Row: { round_id: string; player_id: string; answered: boolean; answered_at: string | null }
        Insert: never
        Update: never
        Relationships: []
      }
      live_quiz_sessions: {
        Row: {
          id: string
          code: string
          name: string
          question_set_id: string
          scoring_config_id: string
          status: DuelMatchStatus
          phase: LiveQuizPhase
          current_question_number: number
          questions_total: number
          lobby_locked: boolean
          hide_statement_on_phone: boolean
          show_ranking_after_question: boolean
          ranking_size: number
          enable_speed_bonus: boolean
          enable_penalty: boolean
          penalty_wrong: number
          end_when_all_answered: boolean
          is_rehearsal: boolean
          paused: boolean
          finalists_count: number
          duel_question_set_id: string | null
          duel_scoring_config_id: string | null
          duel_rounds_total: number
          duel_win_condition: DuelWinCondition
          rules_text: string | null
          final_question_set_id: string | null
          presenter_id: string | null
          screen_message: string | null
          promoted_duel_match_id: string | null
          semifinal1_match_id: string | null
          semifinal2_match_id: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['live_quiz_sessions']['Row'], 'id' | 'code' | 'created_at' | 'updated_at'>> & {
          name: string
          question_set_id: string
          scoring_config_id: string
        }
        Update: Partial<Database['public']['Tables']['live_quiz_sessions']['Row']>
        Relationships: []
      }
      live_quiz_defaults: {
        Row: {
          id: boolean
          question_set_id: string | null
          scoring_config_id: string | null
          questions_total: number
          show_ranking_after_question: boolean
          hide_statement_on_phone: boolean
          finalists_count: number
          duel_question_set_id: string | null
          duel_scoring_config_id: string | null
          duel_rounds_total: number
          duel_win_condition: DuelWinCondition
          rules_text: string
          final_question_set_id: string | null
          updated_at: string
        }
        Insert: never
        Update: Partial<Omit<Database['public']['Tables']['live_quiz_defaults']['Row'], 'id' | 'updated_at'>>
        Relationships: []
      }
      live_quiz_participants: {
        Row: {
          id: string
          session_id: string
          display_name: string
          team: string | null
          device_fingerprint: string | null
          avatar_color: string
          connected: boolean
          total_score: number
          correct_count: number
          current_streak: number
          best_streak: number
          is_finalist: boolean
          is_spectator: boolean
          promoted_duel_player_id: string | null
          joined_at: string
          left_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      live_quiz_rounds: {
        Row: {
          id: string
          session_id: string
          round_number: number
          question_id: string | null
          phase: LiveQuizPhase
          timer_started_at: string | null
          timer_duration_seconds: number
          timer_paused_at: string | null
          timer_accumulated_ms: number
          revealed_at: string | null
          voided: boolean
          is_tiebreaker: boolean
          tiebreak_participant_ids: string[] | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      live_quiz_answers: {
        Row: {
          id: string
          round_id: string
          participant_id: string
          option_id: string | null
          is_correct: boolean
          is_late: boolean
          response_time_ms: number | null
          points_awarded: number
          answered_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      live_quiz_answer_flags: {
        Row: { round_id: string; participant_id: string; answered: boolean; answered_at: string | null }
        Insert: never
        Update: never
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          actor_role: string | null
          action: string
          entity: string
          entity_id: string | null
          payload: Json | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      game_control: {
        Row: {
          id: boolean
          active_mode: 'none' | 'individual' | 'duel' | 'live_quiz'
          active_individual_session_id: string | null
          active_duel_match_id: string | null
          active_live_quiz_session_id: string | null
          updated_at: string
        }
        Insert: never
        Update: Partial<{
          active_mode: 'none' | 'individual' | 'duel' | 'live_quiz'
          active_individual_session_id: string | null
          active_duel_match_id: string | null
          active_live_quiz_session_id: string | null
        }>
        Relationships: []
      }
    }
    Views: {
      v_live_quiz_ranking: {
        Row: {
          session_id: string
          participant_id: string
          display_name: string
          team: string | null
          total_score: number
          correct_count: number
          best_streak: number
          is_finalist: boolean
          is_spectator: boolean
          avg_correct_response_ms: number | null
          rank: number
        }
        Relationships: []
      }
      v_individual_ranking: {
        Row: {
          session_id: string
          participant_id: string
          display_name: string
          team: string | null
          total_score: number
          correct_count: number
          total_time_ms: number
          finished_at: string
          rank: number
        }
        Relationships: []
      }
      v_question_stats: {
        Row: {
          question_id: string
          statement: string
          category_id: string | null
          times_answered_individual: number
          times_answered_duel: number
          times_answered: number
          correct_rate_pct: number | null
          avg_time_ms: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      start_individual_attempt: {
        Args: { p_session_id: string; p_display_name: string; p_team?: string | null; p_device_fingerprint?: string | null }
        Returns: Json
      }
      get_current_individual_question: { Args: { p_attempt_id: string }; Returns: Json }
      submit_individual_answer: {
        Args: { p_attempt_id: string; p_question_id: string; p_option_id: string | null }
        Returns: Json
      }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_admin_or_presenter: { Args: Record<string, never>; Returns: boolean }
      create_duel_match: {
        Args: { p_name: string | null; p_question_set_id: string; p_scoring_config_id: string; p_rounds_total?: number }
        Returns: Json
      }
      join_duel_match: { Args: { p_code: string; p_display_name: string }; Returns: Json }
      // Retorna { matchId, playerId, joinToken, code } — joinToken deve ser
      // guardado pelo cliente (nunca é possível recuperá-lo depois, pois a
      // coluna não é exposta por select público).
      presenter_select_disputants: { Args: { p_match_id: string; p_player_ids: string[] }; Returns: void }
      presenter_start_match: { Args: { p_match_id: string }; Returns: void }
      presenter_show_question: { Args: { p_match_id: string }; Returns: Json }
      presenter_start_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_pause_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_resume_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_end_question_early: { Args: { p_match_id: string }; Returns: void }
      submit_duel_answer: {
        Args: { p_round_id: string; p_player_id: string; p_join_token: string; p_option_id: string | null }
        Returns: Json
      }
      presenter_reveal_answer: { Args: { p_match_id: string }; Returns: void }
      presenter_void_question: { Args: { p_match_id: string }; Returns: void }
      presenter_restart_round: { Args: { p_match_id: string }; Returns: void }
      presenter_next_round: { Args: { p_match_id: string }; Returns: Json }
      presenter_end_match: { Args: { p_match_id: string; p_winner_player_id?: string | null }; Returns: void }
      // Versões "pareadas": aplicam a ação nas duas semifinais de uma vez
      // (mesma pergunta, mesmo instante) — passe o id de qualquer uma delas.
      presenter_show_paired_duel_question: { Args: { p_match_id: string }; Returns: Json }
      presenter_start_paired_duel_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_pause_paired_duel_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_resume_paired_duel_timer: { Args: { p_match_id: string }; Returns: void }
      presenter_end_paired_duel_question_early: { Args: { p_match_id: string }; Returns: void }
      presenter_reveal_paired_duel_answer: { Args: { p_match_id: string }; Returns: void }
      presenter_void_paired_duel_question: { Args: { p_match_id: string }; Returns: void }
      presenter_restart_paired_duel_round: { Args: { p_match_id: string }; Returns: void }
      presenter_next_paired_duel_round: { Args: { p_match_id: string }; Returns: Json }
      // Reabre uma partida encerrada em empate pra rodar mais uma rodada,
      // puxando perguntas do pool da etapa 1 (evita esgotar o pool do duelo).
      presenter_extend_duel_tiebreak: { Args: { p_match_id: string }; Returns: Json }
      presenter_set_manual_score: { Args: { p_round_id: string; p_player_id: string; p_points: number }; Returns: void }
      presenter_disconnect_player: { Args: { p_player_id: string }; Returns: void }
      presenter_set_player_connected: {
        Args: { p_player_id: string; p_connected: boolean }
        Returns: void
      }
      presenter_lock_match: { Args: { p_match_id: string; p_locked: boolean }; Returns: void }
      presenter_send_screen_message: { Args: { p_match_id: string; p_message: string }; Returns: void }
      get_public_duel_round_question: { Args: { p_round_id: string }; Returns: Json }
      get_duel_round_result: { Args: { p_round_id: string }; Returns: Json }
      // Quiz coletivo ao vivo — mesma máquina de estados do duelo,
      // generalizada para N participantes. Ver 00000000000017_live_quiz_rpc.sql.
      get_public_live_quiz_round_question: { Args: { p_round_id: string }; Returns: Json }
      get_live_quiz_round_result: { Args: { p_round_id: string }; Returns: Json }
      join_live_quiz: {
        Args: { p_code: string; p_display_name: string; p_team?: string | null; p_device_fingerprint?: string | null }
        Returns: Json
      }
      // Retorna { sessionId, participantId, joinToken, code, restored } —
      // joinToken deve ser guardado pelo cliente (ver lib/liveQuizStorage.ts).
      get_my_live_quiz_promotion: { Args: { p_participant_id: string; p_join_token: string }; Returns: Json }
      presenter_open_live_quiz_lobby: { Args: { p_session_id: string }; Returns: void }
      presenter_lock_live_quiz_lobby: { Args: { p_session_id: string; p_locked: boolean }; Returns: void }
      presenter_show_live_quiz_rules: { Args: { p_session_id: string }; Returns: void }
      presenter_start_live_quiz: { Args: { p_session_id: string }; Returns: void }
      presenter_show_live_quiz_question: { Args: { p_session_id: string }; Returns: Json }
      presenter_start_live_quiz_timer: { Args: { p_session_id: string }; Returns: void }
      presenter_pause_live_quiz_timer: { Args: { p_session_id: string }; Returns: void }
      presenter_resume_live_quiz_timer: { Args: { p_session_id: string }; Returns: void }
      presenter_extend_live_quiz_timer: { Args: { p_session_id: string; p_extra_seconds: number }; Returns: void }
      presenter_end_live_quiz_question_early: { Args: { p_session_id: string }; Returns: void }
      submit_live_quiz_answer: {
        Args: { p_round_id: string; p_participant_id: string; p_join_token: string; p_option_id: string | null }
        Returns: Json
      }
      presenter_reveal_live_quiz_answer: { Args: { p_session_id: string }; Returns: void }
      presenter_show_live_quiz_ranking: { Args: { p_session_id: string }; Returns: void }
      presenter_void_live_quiz_question: { Args: { p_session_id: string }; Returns: void }
      presenter_restart_live_quiz_round: { Args: { p_session_id: string }; Returns: void }
      presenter_next_live_quiz_question: { Args: { p_session_id: string }; Returns: Json }
      presenter_start_live_quiz_tiebreaker: { Args: { p_session_id: string; p_participant_ids: string[] }; Returns: Json }
      presenter_select_live_quiz_finalists: { Args: { p_session_id: string }; Returns: Json }
      presenter_replace_live_quiz_finalist: {
        Args: { p_session_id: string; p_out_participant_id: string; p_in_participant_id: string }
        Returns: void
      }
      // Com finalists_count=2, cria o duelo final direto ({matchId}). Com
      // finalists_count=4, cria as duas semifinais
      // ({semifinal1MatchId, semifinal2MatchId}).
      presenter_start_duel_from_live_quiz: { Args: { p_session_id: string }; Returns: Json }
      // Só existe no formato de 4 finalistas: cria a final entre os
      // vencedores das semifinais, depois que ambas terminarem.
      presenter_start_live_quiz_final: { Args: { p_session_id: string }; Returns: Json }
      // Chamada pela tela do duelo quando a partida atual termina, pra
      // descobrir se esse jogador venceu uma semifinal e foi promovido
      // pra final.
      get_my_live_quiz_reentry: { Args: { p_duel_player_id: string; p_duel_join_token: string }; Returns: Json }
      presenter_set_live_quiz_manual_score: {
        Args: { p_round_id: string; p_participant_id: string; p_points: number }
        Returns: void
      }
      presenter_disconnect_live_quiz_participant: { Args: { p_participant_id: string }; Returns: void }
      presenter_set_live_quiz_participant_connected: {
        Args: { p_participant_id: string; p_connected: boolean }
        Returns: void
      }
      presenter_send_live_quiz_screen_message: { Args: { p_session_id: string; p_message: string }; Returns: void }
      presenter_set_live_quiz_paused: { Args: { p_session_id: string; p_paused: boolean }; Returns: void }
      presenter_cancel_live_quiz: { Args: { p_session_id: string }; Returns: void }
      presenter_finish_live_quiz: { Args: { p_session_id: string }; Returns: void }
      // Cria e já abre o lobby de uma sessão a partir de live_quiz_defaults
      // — usada pelo botão único "Iniciar dinâmica". Retorna { sessionId, code }.
      presenter_start_live_quiz_from_defaults: { Args: { p_name?: string | null }; Returns: Json }
    }
    Enums: {
      admin_role: AdminRole
      question_difficulty: QuestionDifficulty
      question_type: QuestionType
      question_status: QuestionStatus
      game_mode: GameMode
      question_order_mode: QuestionOrderMode
      individual_session_status: IndividualSessionStatus
      duel_match_status: DuelMatchStatus
      duel_rounds_mode: DuelRoundsMode
      duel_win_condition: DuelWinCondition
      duel_phase: DuelPhase
      live_quiz_phase: LiveQuizPhase
    }
  }
}
