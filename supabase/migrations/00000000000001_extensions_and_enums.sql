-- Extensões e tipos enumerados usados em todo o schema.

create extension if not exists pgcrypto;

create type admin_role as enum ('admin', 'presenter');
create type question_difficulty as enum ('easy', 'medium', 'hard');
create type question_type as enum (
  'single_choice',
  'true_false',
  'multiple_choice',
  'image',
  'poll',
  'tiebreaker'
);
create type question_status as enum ('active', 'inactive', 'archived');
create type game_mode as enum ('individual', 'duel');
create type question_order_mode as enum ('fixed', 'random');
create type individual_session_status as enum ('draft', 'scheduled', 'open', 'closed');
create type duel_match_status as enum ('draft', 'lobby', 'in_progress', 'finished', 'cancelled');
create type duel_rounds_mode as enum ('fixed_count', 'best_of', 'free');
create type duel_win_condition as enum ('score', 'correct_count');

-- Máquina de estados da rodada/partida de duelo (seção 4.3 do briefing).
create type duel_phase as enum (
  'waiting_players',
  'players_connected',
  'ready',
  'question_shown',
  'awaiting_answers',
  'answers_received',
  'time_up',
  'result_revealed',
  'match_ended'
);
