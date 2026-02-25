
-- Tabela de mapeamento: instância (Evolution) -> usuário responsável
create table if not exists public.instance_user_assignments (
  id uuid primary key default gen_random_uuid(),
  instance text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evitar duplicidade para o mesmo par (instância, usuário)
create unique index if not exists idx_instance_user_unique
  on public.instance_user_assignments (instance, user_id);

-- Garantir apenas um "padrão" por instância
create unique index if not exists uq_default_assignment_per_instance
  on public.instance_user_assignments (instance)
  where is_default;

-- Índice simples por instância para consultas frequentes
create index if not exists idx_instance_user_assignments_instance
  on public.instance_user_assignments (instance);

-- Atualizar updated_at automaticamente
create trigger trg_instance_user_assignments_updated_at
  before update on public.instance_user_assignments
  for each row execute function public.update_updated_at_column();

-- Ativar RLS
alter table public.instance_user_assignments enable row level security;

-- Política permissiva (em linha com outras tabelas do projeto)
create policy "Allow all operations on instance_user_assignments"
  on public.instance_user_assignments
  for all
  using (true)
  with check (true);
