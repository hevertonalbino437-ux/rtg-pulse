import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Funcionario = {
  id: string;
  nome: string;
};

type UltimaEscala = {
  funcionario_id: string;
  fim: string;
};

type AllocationStatus = {
  permitido: boolean;
  mensagem: string;
};

type LinhaEscala = {
  id: string;
  nome: string;
  ultimaSaida: string | null;
  status: AllocationStatus | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function toDatetimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Sem historico";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Data invalida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function parseRpcResult(payload: unknown): AllocationStatus {
  if (typeof payload === "boolean") {
    return {
      permitido: payload,
      mensagem: payload ? "Apto para alocacao." : "Intervalo de descanso inferior a 11 horas.",
    };
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as { permitido?: unknown; mensagem?: unknown };
    if (typeof candidate.permitido === "boolean") {
      return {
        permitido: candidate.permitido,
        mensagem:
          typeof candidate.mensagem === "string"
            ? candidate.mensagem
            : candidate.permitido
              ? "Apto para alocacao."
              : "Intervalo de descanso inferior a 11 horas.",
      };
    }
  }

  return {
    permitido: false,
    mensagem: "Resposta inesperada da funcao RPC verificar_alocacao.",
  };
}

async function checkAllocationStatus(
  client: SupabaseClient,
  funcionarioId: string,
  inicioPropostoIso: string
): Promise<AllocationStatus> {
  const payloadOptions = [
    { p_funcionario_id: funcionarioId, p_horario_proposto: inicioPropostoIso },
    { funcionario_id: funcionarioId, horario_proposto: inicioPropostoIso },
  ];

  for (const rpcPayload of payloadOptions) {
    const { data, error } = await client.rpc("verificar_alocacao", rpcPayload);

    if (!error) {
      return parseRpcResult(data);
    }
  }

  return {
    permitido: false,
    mensagem: "Nao foi possivel validar a alocacao via RPC verificar_alocacao.",
  };
}

export default function App() {
  const [busca, setBusca] = useState("");
  const [inicioProposto, setInicioProposto] = useState(() => {
    const base = new Date();
    base.setHours(base.getHours() + 12);
    return toDatetimeLocalValue(base);
  });
  const [linhas, setLinhas] = useState<LinhaEscala[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    async function loadFuncionarios() {
      if (!supabase) {
        setErro("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para conectar ao banco.");
        setCarregando(false);
        return;
      }

      setErro(null);
      setCarregando(true);

      const { data: funcionarios, error: funcionariosError } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (funcionariosError) {
        setErro(`Falha ao carregar funcionarios: ${funcionariosError.message}`);
        setCarregando(false);
        return;
      }

      const listaFuncionarios = (funcionarios as Funcionario[] | null) ?? [];

      if (listaFuncionarios.length === 0) {
        setLinhas([]);
        setCarregando(false);
        return;
      }

      const ids = listaFuncionarios.map((item) => item.id);
      const { data: escalas, error: escalasError } = await supabase
        .from("escalas_trabalho")
        .select("funcionario_id, fim")
        .in("funcionario_id", ids)
        .order("fim", { ascending: false });

      if (escalasError) {
        setErro(`Falha ao carregar historico de turnos: ${escalasError.message}`);
        setCarregando(false);
        return;
      }

      const ultimasEscalas = new Map<string, string>();
      ((escalas as UltimaEscala[] | null) ?? []).forEach((escala) => {
        if (!ultimasEscalas.has(escala.funcionario_id)) {
          ultimasEscalas.set(escala.funcionario_id, escala.fim);
        }
      });

      setLinhas(
        listaFuncionarios.map((funcionario) => ({
          id: funcionario.id,
          nome: funcionario.nome,
          ultimaSaida: ultimasEscalas.get(funcionario.id) ?? null,
          status: null,
        }))
      );
      setCarregando(false);
    }

    void loadFuncionarios();
  }, []);

  useEffect(() => {
    async function validarTodos() {
      if (!supabase || linhas.length === 0 || !inicioProposto) {
        return;
      }

      const inicioPropostoDate = new Date(inicioProposto);
      if (Number.isNaN(inicioPropostoDate.getTime())) {
        return;
      }
      const inicioPropostoIso = inicioPropostoDate.toISOString();

      setValidando(true);

      const resultados = await Promise.all(
        linhas.map(async (linha) => {
          const status = await checkAllocationStatus(supabase, linha.id, inicioPropostoIso);
          return { id: linha.id, status };
        })
      );

      const resultadoPorId = new Map(resultados.map((item) => [item.id, item.status]));

      setLinhas((atual) =>
        atual.map((linha) => ({
          ...linha,
          status: resultadoPorId.get(linha.id) ?? linha.status,
        }))
      );
      setValidando(false);
    }

    void validarTodos();
  }, [inicioProposto, linhas.length]);

  const linhasFiltradas = useMemo(
    () => linhas.filter((linha) => linha.nome.toLowerCase().includes(busca.toLowerCase())),
    [busca, linhas]
  );

  const inicioPropostoFormatado = useMemo(() => {
    const parsed = new Date(inicioProposto);
    if (Number.isNaN(parsed.getTime())) {
      return "Data invalida";
    }
    return formatDateTime(parsed.toISOString());
  }, [inicioProposto]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-12">
        <header className="mb-8 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Porto-Sync</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">Gestao de Escalas</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
            Painel de conformidade operacional com foco no descanso minimo legal entre turnos.
          </p>
        </header>

        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_280px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Buscar funcionario</span>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Digite um nome"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-400 transition focus:ring-2"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Horario de inicio proposto</span>
            <input
              type="datetime-local"
              value={inicioProposto}
              onChange={(event) => setInicioProposto(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-400 transition focus:ring-2"
            />
          </label>
        </div>

        {erro ? <p className="mb-4 text-sm text-rose-300">{erro}</p> : null}

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Nome do Funcionario</th>
                <th className="px-4 py-3 font-medium">Horario de Saida (Ultimo Turno)</th>
                <th className="px-4 py-3 font-medium">Horario de Inicio (Proposto)</th>
                <th className="px-4 py-3 font-medium">Status de Conformidade</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td className="px-4 py-4 text-slate-300" colSpan={4}>
                    Carregando funcionarios...
                  </td>
                </tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-300" colSpan={4}>
                    Nenhum funcionario encontrado.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((linha) => (
                  <tr key={linha.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-slate-100">{linha.nome}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(linha.ultimaSaida)}</td>
                    <td className="px-4 py-3 text-slate-300">{inicioPropostoFormatado}</td>
                    <td className="px-4 py-3">
                      {linha.status ? (
                        linha.status.permitido ? (
                          <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                            ✅ Apto
                          </span>
                        ) : (
                          <span
                            title={linha.status.mensagem}
                            className="inline-flex rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-200"
                          >
                            ⚠️ Risco de Multa (Intervalo Insuficiente)
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">{validando ? "Validando..." : "Sem status"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
