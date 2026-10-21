-- Imagens nos pedidos de alteração (0088): prints e exemplos que ajudam a
-- explicar o pedido. Ficam no bucket privado "pedido-imagens", na pasta de
-- quem enviou (<pessoa>/<arquivo>); a equipe vê pelo /arquivos (com login).
-- dhub_pedidos.imagens guarda os caminhos (até 10).
--
-- Pode rodar de novo sem problema.

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('pedido-imagens', 'pedido-imagens', false, array['image/*'], 10485760)
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types, file_size_limit = excluded.file_size_limit;

drop policy if exists "pedido_imagens_ler" on storage.objects;
create policy "pedido_imagens_ler" on storage.objects for select to authenticated
  using (bucket_id = 'pedido-imagens');

-- Cada pessoa só envia e apaga na própria pasta.
drop policy if exists "pedido_imagens_enviar" on storage.objects;
create policy "pedido_imagens_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'pedido-imagens' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pedido_imagens_apagar" on storage.objects;
create policy "pedido_imagens_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'pedido-imagens' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.dhub_pedidos
  add column if not exists imagens text[] not null default '{}'::text[];

do $$
begin
  alter table public.dhub_pedidos
    add constraint dhub_pedidos_imagens_limite check (cardinality(imagens) <= 10);
exception when duplicate_object then null;
end $$;

-- Imagem nova no pedido: só da pasta de quem está mexendo, e mudar as imagens
-- segue a regra de mudar o texto (quem pediu, enquanto aguarda, ou quem aprova).
create or replace function public.fn_imagens_do_pedido()
returns trigger
language plpgsql
as $$
declare
  eu uuid := auth.uid();
  caminho text;
begin
  if eu is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.imagens is distinct from old.imagens then
    if not (
      exists (select 1 from public.profiles p where p.id = eu and p.aprova_pedidos_dhub is true)
      or (old.created_by = eu and old.status = 'aguardando')
    ) then
      raise exception 'Só quem pediu (enquanto aguarda aprovação) ou quem aprova muda as imagens do pedido.';
    end if;
  end if;
  foreach caminho in array coalesce(new.imagens, '{}'::text[]) loop
    if caminho like '%..%' or (
      caminho not like eu::text || '/%'
      and not (tg_op = 'UPDATE' and caminho = any(old.imagens))
    ) then
      raise exception 'Imagem inválida no pedido.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_imagens_do_pedido on public.dhub_pedidos;
create trigger trg_imagens_do_pedido
  before insert or update of imagens on public.dhub_pedidos
  for each row execute function public.fn_imagens_do_pedido();
