-- Porto-Sync MVP - schema complementar + RPC + dados de teste
-- Executar no Supabase SQL Editor

create extension if not exists pgcrypto;

-- 1) Schema base
create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf varchar(14) not null unique,
  cargo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.escalas_trabalho (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'concluida',
  created_at timestamptz not null default now(),
  constraint escalas_trabalho_periodo_valido check (fim > inicio),
  constraint escalas_trabalho_status_valido check (status in ('agendada', 'confirmada', 'cancelada', 'concluida'))
);

create table if not exists public.certificacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  nome_nr text not null,
  data_vencimento date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_escalas_funcionario_fim
  on public.escalas_trabalho (funcionario_id, fim desc);

create index if not exists idx_certificacoes_funcionario_vencimento
  on public.certificacoes (funcionario_id, data_vencimento);

-- 2) RPC de inteligencia (11h + NR)
drop function if exists public.verificar_alocacao(uuid, timestamptz);

create or replace function public.verificar_alocacao(
  p_funcionario_id uuid,
  p_horario_proposto timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fim_ultimo_turno timestamptz;
  v_horas_descanso numeric;
  v_nr_vencida text;
begin
  -- Busca o ultimo turno encerrado antes do horario proposto.
  select et.fim
    into v_fim_ultimo_turno
  from public.escalas_trabalho et
  where et.funcionario_id = p_funcionario_id
    and et.status <> 'cancelada'
    and et.fim <= p_horario_proposto
  order by et.fim desc
  limit 1;

  if v_fim_ultimo_turno is not null then
    v_horas_descanso := extract(epoch from (p_horario_proposto - v_fim_ultimo_turno)) / 3600.0;

    if v_horas_descanso < 11 then
      return jsonb_build_object(
        'permitido', false,
        'mensagem', format(
          'Descanso insuficiente: %s h cumpridas. Minimo legal: 11 h.',
          round(v_horas_descanso, 2)::text
        )
      );
    end if;
  end if;

  -- Bloqueia se houver qualquer NR vencida na data proposta.
  select c.nome_nr
    into v_nr_vencida
  from public.certificacoes c
  where c.funcionario_id = p_funcionario_id
    and c.data_vencimento < p_horario_proposto::date
  order by c.data_vencimento asc
  limit 1;

  if v_nr_vencida is not null then
    return jsonb_build_object(
      'permitido', false,
      'mensagem', format('NR vencida para a data proposta: %s.', v_nr_vencida)
    );
  end if;

  return jsonb_build_object(
    'permitido', true,
    'mensagem', 'Alocacao permitida.'
  );
end;
$$;

grant execute on function public.verificar_alocacao(uuid, timestamptz) to anon, authenticated, service_role;

-- 3) Dados de teste
delete from public.certificacoes
where funcionario_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

delete from public.escalas_trabalho
where funcionario_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.funcionarios (id, nome, cpf, cargo, ativo)
values
  ('11111111-1111-1111-1111-111111111111', 'Joao Pereira', '123.456.789-00', 'Tecnico de Manutencao', true),
  ('22222222-2222-2222-2222-222222222222', 'Mariana Costa', '234.567.890-11', 'Operadora de Patio', true),
  ('33333333-3333-3333-3333-333333333333', 'Lucas Almeida', '345.678.901-22', 'Supervisor de Turno', true)
on conflict (id) do update
set nome = excluded.nome,
    cpf = excluded.cpf,
    cargo = excluded.cargo,
    ativo = excluded.ativo;

-- Joao: ultimo turno encerrou ha 5h (deve reprovar na regra de descanso)
insert into public.escalas_trabalho (funcionario_id, inicio, fim, status)
values (
  '11111111-1111-1111-1111-111111111111',
  now() - interval '13 hours',
  now() - interval '5 hours',
  'concluida'
);

-- Mariana: ultimo turno encerrou ha 15h (deve passar na regra de descanso)
insert into public.escalas_trabalho (funcionario_id, inicio, fim, status)
values (
  '22222222-2222-2222-2222-222222222222',
  now() - interval '23 hours',
  now() - interval '15 hours',
  'concluida'
);

-- Lucas: ultimo turno encerrou ha 16h (passa descanso), mas tem NR vencida
insert into public.escalas_trabalho (funcionario_id, inicio, fim, status)
values (
  '33333333-3333-3333-3333-333333333333',
  now() - interval '24 hours',
  now() - interval '16 hours',
  'concluida'
);

insert into public.certificacoes (funcionario_id, nome_nr, data_vencimento)
values
  ('11111111-1111-1111-1111-111111111111', 'NR-35', current_date + 180),
  ('22222222-2222-2222-2222-222222222222', 'NR-29', current_date + 120),
  ('33333333-3333-3333-3333-333333333333', 'NR-35', current_date - 10);
