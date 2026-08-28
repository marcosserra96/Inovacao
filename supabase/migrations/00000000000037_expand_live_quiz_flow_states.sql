-- Amplia os estados permitidos para o fluxo unificado da dinâmica.
-- Necessário para as transições explícitas de semifinal e final usadas pelo novo motor.

alter table live_quiz_sessions
  drop constraint if exists live_quiz_sessions_flow_state_check;

alter table live_quiz_sessions
  add constraint live_quiz_sessions_flow_state_check
  check (
    flow_state = any (
      array[
        'lobby',
        'prepare',
        'question',
        'reveal',
        'ranking',
        'quiz_result',
        'semifinal_ready',
        'semifinal',
        'semifinal_prepare',
        'semifinal_question',
        'semifinal_reveal',
        'semifinal_result',
        'final_ready',
        'final',
        'final_prepare',
        'final_question',
        'final_reveal',
        'champion',
        'finished'
      ]::text[]
    )
  );
