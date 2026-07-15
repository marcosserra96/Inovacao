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
export type GameMode = 'individual' | 'duel'
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
          active_mode: 'none' | 'individual' | 'duel'
          active_individual_session_id: string | null
          active_duel_match_id: string | null
          updated_at: string
        }
        Insert: never
        Update: Partial<{
          active_mode: 'none' | 'individual' | 'duel'
          active_individual_session_id: string | null
          active_duel_match_id: string | null
        }>
        Relationships: []
      }
    }
    Views: {
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
    }
  }
}
