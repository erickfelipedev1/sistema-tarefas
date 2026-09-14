-- Cor escolhida pra tarefa (mostrada como uma tarja/bolinha colorida no
-- quadro e no calendário). Guarda só uma chave da paleta fixa do app.
alter table public.tasks add column if not exists color text;

alter table public.tasks drop constraint if exists tasks_color_valido;
alter table public.tasks add constraint tasks_color_valido
  check (
    color is null or color in
    ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink')
  );
