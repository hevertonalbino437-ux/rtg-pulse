import { formatChecklistObservation } from "../hooks/useChecklistAttributes";

type StatusCode = "OK" | "DN" | "AV" | "IN" | "NA" | "NI";

type ChecklistRow = {
  item: string;
  status: StatusCode;
  obs: string;
  paintingState?: "" | "nova" | "usada";
  gateMaterial?: "" | "madeira" | "ferro" | "aluminio" | "pvc";
};

type EvidenceItem = {
  id: string;
  caption: string;
  url?: string;
};

type EnvironmentBlock = {
  name: string;
  checklist: ChecklistRow[];
  evidences: EvidenceItem[];
};

export type LaudoVisualizationData = {
  generatedAt: string;
  address: string;
  inspector: string;
  company: string;
  inspectionType: string;
  authCode: string;
  environments: EnvironmentBlock[];
};

type LaudoVisualizationPageProps = {
  data: LaudoVisualizationData;
};

const isCritical = (status: StatusCode) => status === "DN" || status === "IN" || status === "AV";

const statusClass = (status: StatusCode) => {
  if (status === "OK") return "text-emerald-700 font-semibold";
  if (isCritical(status)) return "text-red-700 font-semibold";
  return "text-slate-700";
};

export default function LaudoVisualizationPage({ data }: LaudoVisualizationPageProps) {
  const criticalRows = data.environments.flatMap((environment) =>
    environment.checklist
      .filter((row) => isCritical(row.status))
      .map((row) => ({ environment: environment.name, row }))
  );

  return (
    <article className="mx-auto w-full max-w-[920px] bg-white p-6 text-slate-800 print:max-w-none print:p-4">
      <header className="mb-4 border-b border-slate-400 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-[28px] font-bold tracking-tight text-slate-800">REDEMAIS VISTORIAS</p>
          <p className="text-xs text-slate-600">Laudo Gerado em: {data.generatedAt}</p>
        </div>
      </header>

      <section className="mb-4 text-center">
        <h1 className="text-[31px] font-extrabold uppercase tracking-tight text-slate-800">
          Laudo Tecnico de Vistoria Imobiliaria
        </h1>
        <p className="mt-1 text-sm text-slate-600">Documento tecnico para uso locaticio e juridico</p>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-0 border border-slate-300 text-sm">
        <InfoCell label="Endereco do Imovel" value={data.address} />
        <InfoCell label="Vistoriador Responsavel" value={data.inspector} />
        <InfoCell label="Imobiliaria Parceira" value={data.company} />
        <InfoCell label="Tipo de Vistoria" value={data.inspectionType} />
      </section>

      <SectionTitle title="Sumario de Pendencias Criticas (AV / IN / DN)" />
      <table className="mb-4 w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-xs uppercase text-slate-700">
            <th className="w-[20%] border border-slate-300 px-2 py-1.5">Ambiente</th>
            <th className="w-[26%] border border-slate-300 px-2 py-1.5">Item</th>
            <th className="w-[10%] border border-slate-300 px-2 py-1.5">Status</th>
            <th className="w-[44%] border border-slate-300 px-2 py-1.5">Observacao Tecnica</th>
          </tr>
        </thead>
        <tbody>
          {criticalRows.length ? (
            criticalRows.map((entry) => (
              <tr key={`${entry.environment}-${entry.row.item}`}>
                <td className="border border-slate-300 px-2 py-1.5">{entry.environment}</td>
                <td className="border border-slate-300 px-2 py-1.5">{entry.row.item}</td>
                <td className={`border border-slate-300 px-2 py-1.5 ${statusClass(entry.row.status)}`}>
                  {entry.row.status}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 italic text-slate-700">
                  {formatChecklistObservation(entry.row) || "Sem observacao"}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="border border-slate-300 px-2 py-2 text-center text-sm text-slate-500" colSpan={4}>
                Nenhuma pendencia critica encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {data.environments.map((environment) => (
        <section key={environment.name} className="mb-4 break-inside-avoid">
          <SectionTitle title={`Detalhamento: Ambiente ${environment.name}`} />
          <table className="mb-3 w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase text-slate-700">
                <th className="w-[32%] border border-slate-300 px-2 py-1.5">Item</th>
                <th className="w-[12%] border border-slate-300 px-2 py-1.5">Status</th>
                <th className="w-[56%] border border-slate-300 px-2 py-1.5">Atributos / Observacoes</th>
              </tr>
            </thead>
            <tbody>
              {environment.checklist.map((row) => (
                <tr key={`${environment.name}-${row.item}`}>
                  <td className="border border-slate-300 px-2 py-1.5">{row.item}</td>
                  <td className={`border border-slate-300 px-2 py-1.5 ${statusClass(row.status)}`}>
                    {row.status}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    {formatChecklistObservation(row) || "Sem observacao"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <SectionTitle title="Evidencias Fotograficas" />
          <div className="grid grid-cols-3 gap-1.5 rounded border border-slate-300 p-1.5">
            {environment.evidences.length ? (
              environment.evidences.map((evidence) => (
                <figure
                  key={evidence.id}
                  className="flex h-[92px] items-center justify-center rounded border border-slate-300 bg-slate-100"
                >
                  {evidence.url ? (
                    <img
                      src={evidence.url}
                      alt={evidence.caption}
                      className="h-full w-full rounded object-cover"
                    />
                  ) : (
                    <figcaption className="px-2 text-center text-[11px] text-slate-500">{evidence.caption}</figcaption>
                  )}
                </figure>
              ))
            ) : (
              <p className="col-span-3 py-4 text-center text-xs text-slate-500">Sem evidencias registradas</p>
            )}
          </div>
        </section>
      ))}

      <footer className="mt-6 border-t border-slate-300 pt-2 text-center text-[11px] text-slate-500">
        Este laudo possui fe publica entre as partes. Codigo de Autenticidade: {data.authCode}
      </footer>
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-300 px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase text-slate-600">{label}</p>
      <p className="text-[15px] text-slate-800">{value}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-0.5 bg-[#1d476f] px-2 py-1.5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">{title}</h2>
    </div>
  );
}
