import { ChangeEvent, useMemo, useState } from "react";

type StatusCode = "OK" | "DN" | "AV" | "IN" | "NA" | "NI";

type ChecklistItem = {
  id: string;
  name: string;
  status?: StatusCode;
  observation: string;
  photos: File[];
};

const STATUS_DICTIONARY: Record<StatusCode, { label: string; color: string; ring: string }> = {
  OK: { label: "Bom Estado", color: "bg-emerald-500/15 text-emerald-300", ring: "ring-emerald-400/60" },
  DN: { label: "Danificado", color: "bg-red-500/15 text-red-300", ring: "ring-red-400/60" },
  AV: { label: "Avariado", color: "bg-amber-500/15 text-amber-300", ring: "ring-amber-400/60" },
  IN: { label: "Inoperante", color: "bg-fuchsia-500/15 text-fuchsia-300", ring: "ring-fuchsia-400/60" },
  NA: { label: "Nao se Aplica", color: "bg-slate-500/20 text-slate-300", ring: "ring-slate-400/60" },
  NI: { label: "Nao Inspecionado", color: "bg-cyan-500/15 text-cyan-300", ring: "ring-cyan-400/60" },
};

const EXAMPLE_ITEMS: ChecklistItem[] = [
  { id: "piso", name: "Piso", observation: "", photos: [] },
  { id: "pintura", name: "Pintura", observation: "", photos: [] },
  { id: "janelas", name: "Janelas", observation: "", photos: [] },
  { id: "tomadas", name: "Tomadas", observation: "", photos: [] },
];

export default function EnvironmentChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>(EXAMPLE_ITEMS);
  const [legendHint, setLegendHint] = useState<StatusCode | null>(null);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "DN" || item.status === "IN").length,
    [items]
  );

  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const onPhotoChange = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    updateItem(id, { photos: files });
  };

  return (
    <section className="mx-auto w-full max-w-2xl space-y-3 p-3 text-slate-100">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Checklist Dinamico por Ambiente</h2>
        <p className="text-xs text-slate-400">Pendencias criticas (DN/IN): {pendingCount}</p>
      </header>

      <div className="sticky top-0 z-20 rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(STATUS_DICTIONARY) as StatusCode[]).map((code) => (
            <button
              key={code}
              type="button"
              className={`rounded px-2 py-1 text-[11px] font-semibold ${STATUS_DICTIONARY[code].color}`}
              title={`${code}: ${STATUS_DICTIONARY[code].label}`}
              onClick={() => setLegendHint((prev) => (prev === code ? null : code))}
            >
              {code}
            </button>
          ))}
        </div>
        {legendHint && (
          <p className="mt-1 text-[11px] text-slate-300">
            <strong>{legendHint}</strong>: {STATUS_DICTIONARY[legendHint].label}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const isCritical = item.status === "DN" || item.status === "IN";

          return (
            <li
              key={item.id}
              className={`rounded-md border p-2.5 ${
                isCritical ? "border-red-400/60 bg-red-950/20" : "border-slate-700 bg-slate-900/40"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{item.name}</p>
                <span className="text-[11px] text-slate-400">{item.status || "Sem status"}</span>
              </div>

              <div className="mb-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {(Object.keys(STATUS_DICTIONARY) as StatusCode[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      item.status === code
                        ? `ring-1 ${STATUS_DICTIONARY[code].ring} ${STATUS_DICTIONARY[code].color}`
                        : "border-slate-600 text-slate-300"
                    }`}
                    onClick={() => updateItem(item.id, { status: code })}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {isCritical && (
                <div className="space-y-2">
                  <textarea
                    required
                    value={item.observation}
                    onChange={(event) => updateItem(item.id, { observation: event.target.value })}
                    className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-cyan-400"
                    placeholder="Observacao obrigatoria para DN/IN"
                  />

                  <label className="inline-flex w-full cursor-pointer items-center justify-center rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-200">
                    Upload de foto obrigatorio (DN/IN)
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => onPhotoChange(item.id, event)}
                    />
                  </label>

                  <p className="text-[11px] text-slate-400">{item.photos.length} arquivo(s) selecionado(s)</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
