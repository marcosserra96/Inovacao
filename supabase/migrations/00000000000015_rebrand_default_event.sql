-- Ajusta o nome do evento e a mensagem de boas-vindas padrão, e atualiza a
-- linha já existente (o projeto já está em produção, então o default de
-- coluna sozinho não mudaria o que está configurado hoje).

alter table event_settings alter column event_name set default 'Inovação EMR';
alter table event_settings alter column dynamic_name set default 'Desafio Inovação EMR';
alter table event_settings alter column welcome_message set default 'A inovação também é uma forma de energia. Bora descobrir a sua?';

update event_settings
set
  event_name = 'Inovação EMR',
  dynamic_name = 'Desafio Inovação EMR',
  welcome_message = 'A inovação também é uma forma de energia. Bora descobrir a sua?'
where id = true
  and event_name = 'Dinâmica de Inovação'; -- só atualiza se ainda estiver no valor padrão anterior (não sobrescreve customização manual)

-- Faltava: sem isso, o ThemeProvider nunca recebia atualizações de marca em
-- tempo real (nenhuma tela de participante lia event_settings de verdade).
alter publication supabase_realtime add table event_settings;
alter table event_settings replica identity full;
