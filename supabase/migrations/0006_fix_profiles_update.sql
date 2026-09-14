-- Faltava permissão de atualização na tabela profiles (só existia leitura),
-- por isso o onboarding não conseguia salvar o nome/foto da pessoa.
create policy "authenticated_update_own_profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
