-- Porto-Sync MVP - schema base para Supabase/PostgreSQL
-- Etapa 1: funcionarios, certificacoes e escalas_trabalho

create extension if not exists pgcrypto;

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text not null unique,
  cargo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  norma_codigo text not null,
  data_emissao date,
  validade date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificacoes_norma_valida check (norma_codigo ~ '^NR-[0-9]{1,2}$')
);

create table if not exists public.escalas_trabalho (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'agendada',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escalas_intervalo_valido check (fim > inicio),
  constraint escalas_status_valido check (status in ('agendada', 'confirmada', 'cancelada', 'concluida'))
);

create index if not exists idx_certificacoes_funcionario_validade
  on public.certificacoes (funcionario_id, validade);

create index if not exists idx_escalas_funcionario_fim_desc
  on public.escalas_trabalho (funcionario_id, fim desc);

create index if not exists idx_escalas_funcionario_inicio
  on public.escalas_trabalho (funcionario_id, inicio);

alter table public.funcionarios enable row level security;
alter table public.certificacoes enable row level security;
alter table public.escalas_trabalho enable row level security;

drop policy if exists "funcionarios_read_authenticated" on public.funcionarios;
create policy "funcionarios_read_authenticated"
  on public.funcionarios
  for select
  to authenticated
  using (true);

drop policy if exists "certificacoes_read_authenticated" on public.certificacoes;
create policy "certificacoes_read_authenticated"
  on public.certificacoes
  for select
  to authenticated
  using (true);

drop policy if exists "escalas_read_authenticated" on public.escalas_trabalho;
create policy "escalas_read_authenticated"
  on public.escalas_trabalho
  for select
  to authenticated
  using (true);