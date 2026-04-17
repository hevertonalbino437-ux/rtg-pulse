# Porto-Sync MVP

Micro-SaaS para validacao de alocacao de equipes em operacoes de logistica e manutencao industrial.

Objetivo do MVP: impedir alocacoes irregulares com base em duas regras de conformidade:

- Descanso minimo de 11 horas entre turnos.
- Certificacoes tecnicas (NRs) nao vencidas na data proposta.

## Visao Geral

Este repositorio contem:

- Frontend React + Vite + Tailwind CSS para visualizacao operacional.
- Integracao com Supabase (PostgreSQL + RPC).
- Scripts SQL de schema, RPC e dados de teste.

Status atual:

- MVP funcional em ambiente de desenvolvimento.
- Validacao principal implementada no banco (RPC) e consumida no frontend.

## Stack Atual

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- Supabase JS 2
- PostgreSQL (Supabase)

Observacao: o blueprint inicial falava em Next.js + Shadcn/UI. A base atual esta em React/Vite. A migracao para Next.js App Router pode ser feita na fase seguinte sem perder a modelagem SQL e a RPC.

## Regras de Negocio (Core)

1. Regra de descanso:
- Para um `funcionario_id`, busca o ultimo turno com `fim <= horario_proposto`.
- Se `(horario_proposto - fim_ultimo_turno) < 11 horas`, a alocacao e negada.

2. Regra de certificacao:
- Se existir NR com `data_vencimento < data do horario_proposto`, a alocacao e negada.

3. Resultado da validacao:
- JSON com formato:

```json
{
  "permitido": true,
  "mensagem": "Alocacao permitida."
}
```

## Estrutura de Pastas

```text
.
├─ index.html
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ index.css
│  └─ server/
│     └─ validateAllocation.ts
└─ supabase/
   └─ migrations/
      ├─ 0001_porto_sync_schema.sql
      └─ 0002_porto_sync_rpc_seed.sql
```

## Banco de Dados (Supabase)

### Tabelas principais

- `funcionarios`
- `escalas_trabalho`
- `certificacoes`

### Arquivos SQL

- `supabase/migrations/0001_porto_sync_schema.sql`
  - schema base, indices e RLS inicial.
- `supabase/migrations/0002_porto_sync_rpc_seed.sql`
  - schema complementar, RPC `verificar_alocacao` e seed com 3 funcionarios.

### RPC esperada pelo frontend

Nome:

- `verificar_alocacao`

Assinatura principal:

- `p_funcionario_id uuid`
- `p_horario_proposto timestamptz`

Retorno:

- `jsonb` com `permitido` e `mensagem`.

## Frontend

Tela principal:

- Dashboard de gestao de escalas.
- Busca por nome de funcionario.
- Tabela com:
  - Nome
  - Horario de saida (ultimo turno)
  - Horario de inicio (proposto)
  - Status de conformidade

Status visual:

- `permitido = true` -> badge verde: `Apto`.
- `permitido = false` -> badge vermelho: `Risco de Multa (Intervalo Insuficiente)` ou mensagem retornada pela RPC.

## Como Rodar Localmente

1. Instalar dependencias:

```bash
npm install
```

2. Criar arquivo `.env` na raiz:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

3. Executar scripts SQL no Supabase SQL Editor:

1. `supabase/migrations/0001_porto_sync_schema.sql`
2. `supabase/migrations/0002_porto_sync_rpc_seed.sql`

4. Rodar o frontend:

```bash
npm run dev
```

5. Build de producao:

```bash
npm run build
```

## Fluxo de Validacao (Fim a Fim)

1. Frontend carrega funcionarios ativos.
2. Frontend busca o ultimo `fim` de escala para exibir contexto na tabela.
3. Para cada funcionario, frontend chama `rpc("verificar_alocacao", ...)` com o horario proposto.
4. RPC aplica regras de descanso + NR.
5. Frontend atualiza badge e mensagem por linha.

## Seguranca e Conformidade

Ja aplicado:

- RLS habilitado nas tabelas principais.
- Politicas de leitura para usuarios autenticados no schema base.
- RPC com `security definer` e grant de execucao.

Recomendado para producao:

- Revisar politicas por tenant/unidade operacional.
- Evitar acesso amplo de `anon` em operacoes sensiveis.
- Adicionar trilha de auditoria de tentativa de alocacao negada.

## Proximas Melhorias (Roadmap)

### Curto prazo (1-2 sprints)

1. Multi-tenant real:
- adicionar `empresa_id` nas tabelas e politicas RLS por empresa.

2. Validacao transacional de alocacao:
- endpoint/server action que valida e grava escala em unica operacao atomica.

3. Alertas operacionais:
- notificacao de NR a vencer (D-30, D-15, D-7).

4. Melhorias de UX:
- paginacao, ordenacao e filtros por cargo/status.

### Medio prazo

1. Motor de regras configuravel:
- permitir regras por cliente (ex.: descanso maior por funcao critica).

2. Dashboard gerencial:
- indicadores de risco, conformidade por turno e taxa de bloqueio preventivo.

3. Integracoes:
- importacao de escala/cadastro via CSV e ERPs legados.

4. Observabilidade:
- logs estruturados e metricas de desempenho da RPC.

### Evolucao de stack (opcional)

1. Migrar frontend para Next.js App Router.
2. Padronizar UI com Shadcn/UI.
3. Consolidar validacoes server-side com Server Actions.

## Riscos Atuais

- Divergencia de stack em relacao ao plano inicial (Vite vs Next.js).
- Dependencia da assinatura exata da RPC no banco.
- Sem controle multi-tenant completo no estado atual.

## Criterio de "MVP Concluido"

Para considerar v1 oficialmente concluida:

1. SQL aplicado no Supabase de producao/homologacao.
2. Variaveis `VITE_SUPABASE_*` configuradas no ambiente.
3. Teste ponta a ponta com dados reais aprovado pelo usuario de negocio.
4. RLS revisado por perfil e empresa.
5. Log de auditoria basico para negacoes de alocacao.

## Licenca

Definir licenca comercial ou open source conforme estrategia do produto.