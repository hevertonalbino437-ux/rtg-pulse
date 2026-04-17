"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type HorarioProposto = {
  inicio: string;
  fim: string;
};

type ValidateAllocationInput = {
  funcionario_id: string;
  horario_proposto: HorarioProposto;
};

export type ValidateAllocationResult = {
  permitido: boolean;
  mensagem: string;
};

const MIN_REST_HOURS = 11;

export async function validateAllocation(
  supabase: SupabaseClient,
  input: ValidateAllocationInput
): Promise<ValidateAllocationResult> {
  const inicioProposto = new Date(input.horario_proposto.inicio);
  const fimProposto = new Date(input.horario_proposto.fim);

  if (Number.isNaN(inicioProposto.getTime()) || Number.isNaN(fimProposto.getTime())) {
    return {
      permitido: false,
      mensagem: "Horario proposto invalido.",
    };
  }

  if (fimProposto <= inicioProposto) {
    return {
      permitido: false,
      mensagem: "Horario proposto invalido: fim deve ser maior que inicio.",
    };
  }

  const inicioIso = inicioProposto.toISOString();

  const [certificacoesVencidasQuery, ultimaEscalaQuery] = await Promise.all([
    supabase
      .from("certificacoes")
      .select("id", { count: "exact", head: true })
      .eq("funcionario_id", input.funcionario_id)
      .lt("validade", inicioIso.slice(0, 10)),
    supabase
      .from("escalas_trabalho")
      .select("id, fim")
      .eq("funcionario_id", input.funcionario_id)
      .lte("fim", inicioIso)
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (certificacoesVencidasQuery.error) {
    return {
      permitido: false,
      mensagem: `Erro ao validar certificacoes: ${certificacoesVencidasQuery.error.message}`,
    };
  }

  if (ultimaEscalaQuery.error) {
    return {
      permitido: false,
      mensagem: `Erro ao validar descanso: ${ultimaEscalaQuery.error.message}`,
    };
  }

  if ((certificacoesVencidasQuery.count ?? 0) > 0) {
    return {
      permitido: false,
      mensagem: "Funcionario possui norma tecnica vencida (ex: NR-35 ou NR-29).",
    };
  }

  if (ultimaEscalaQuery.data) {
    const fimUltimaEscala = new Date((ultimaEscalaQuery.data as { fim: string }).fim);
    const descansoMs = inicioProposto.getTime() - fimUltimaEscala.getTime();
    const descansoHoras = descansoMs / (1000 * 60 * 60);

    if (descansoHoras < MIN_REST_HOURS) {
      const faltamHoras = (MIN_REST_HOURS - descansoHoras).toFixed(2);
      return {
        permitido: false,
        mensagem: `Intervalo minimo de descanso nao cumprido. Faltam ${faltamHoras} hora(s) para completar 11 horas.`,
      };
    }
  }

  return {
    permitido: true,
    mensagem: "Alocacao permitida.",
  };
}