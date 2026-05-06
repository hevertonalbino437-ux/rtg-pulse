import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatChecklistObservation,
  isGateItem,
  requiresPaintingState,
  validateChecklistAttributes,
  type GateMaterial,
  type PaintingState,
} from "./hooks/useChecklistAttributes";

type Tab = "dashboard" | "cadastro" | "vistoria" | "comparacao" | "timeline" | "desempenho";
type InspectionType = "entrada" | "saida" | "mobiliado";
type FinishLevel = "simples" | "medio" | "alto_padrao";
type ChecklistStatus = "" | "ok" | "dn" | "av" | "in" | "na" | "ni";
type Step = 1 | 2 | 3;
type EvidenceType = "photo" | "video";

type Owner = { id: string; name: string; document: string };
type Tenant = { id: string; name: string; document: string };
type Property = { id: string; code: string; address: string; ownerId: string; finishLevel: FinishLevel };
type Contract = { id: string; code: string; propertyId: string; tenantId: string };
type Company = { id: string; name: string; city: string };

type User = { name: string; email: string; password: string };
type SignatureRole = "proprietario" | "inquilino" | "vistoriador";

type Signature = {
  role: SignatureRole;
  name: string;
  accepted: boolean;
  timestamp?: string;
  hash?: string;
};

type ChecklistRow = {
  item: string;
  status: ChecklistStatus;
  obs: string;
  paintingState: PaintingState;
  gateMaterial: GateMaterial;
};

type Photo = {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  blobId?: string;
  evidenceType?: EvidenceType;
  durationSeconds?: number;
};

type EnvironmentId =
  | "fachada"
  | "sala"
  | "cozinha"
  | "servico"
  | "banheiro"
  | "quarto"
  | "sacada"
  | "garagem"
  | "outros";

type EnvironmentData = {
  checklist: ChecklistRow[];
  observations: string;
  photos: Photo[];
};

type Inspection = {
  id: string;
  companyId: string;
  type: InspectionType;
  propertyId: string;
  contractId: string;
  client: string;
  address: string;
  propertyType: string;
  responsible: string;
  inspector: string;
  finishLevel: FinishLevel;
  legalTerms: string;
  complements: string;
  concluded: boolean;
  createdAt: number;
  concludedAt?: number;
  syncedAt?: string;
  environmentOrder: EnvironmentId[];
  environments: Record<EnvironmentId, EnvironmentData>;
  signatures: Signature[];
};

type ToastType = "success" | "warning" | "error" | "info";
type ToastItem = { id: string; message: string; type: ToastType };

const STORAGE_KEY = "redemais-sync-v2";
const MIN_PHOTOS = 10;
const MAX_VIDEO_SECONDS = 15;
const PHOTO_DB_NAME = "redemais-photo-db";
const PHOTO_STORE = "photos";
const REMEMBER_KEY = "redemais-remember-login";
const SUPABASE_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY;

const USERS: User[] = [
  { email: "admin@redemais.com.br", password: "123456", name: "Administrador" },
  { email: "vistoriador@redemais.com.br", password: "123456", name: "Vistoriador" },
];

const COMPANIES: Company[] = [
  { id: "berger", name: "Imobiliária Berger", city: "Paranaguá" },
  { id: "cabine", name: "Cabine Imóveis", city: "Paranaguá" },
  { id: "thaiz-naiad", name: "Thaiz Naiad", city: "Paranaguá" },
  { id: "jose-luiz", name: "Imobiliária José Luiz", city: "Paranaguá" },
  { id: "veleiros", name: "Imobiliária Veleiros", city: "Paranaguá" },
  { id: "debora", name: "Débora Imóveis", city: "Paranaguá" },
];

const ENV_CONFIG: { id: EnvironmentId; name: string }[] = [
  { id: "fachada", name: "Fachada" },
  { id: "sala", name: "Sala" },
  { id: "cozinha", name: "Cozinha" },
  { id: "servico", name: "Area de servico" },
  { id: "banheiro", name: "Banheiros" },
  { id: "quarto", name: "Quartos" },
  { id: "sacada", name: "Sacada" },
  { id: "garagem", name: "Garagem" },
  { id: "outros", name: "Outros" },
];

const CHECKLIST_CONFIG: Record<EnvironmentId, string[]> = {
  fachada: ["Portao/grade", "Pintura externa", "Calcada/piso", "Iluminacao", "Interfone/campainha", "Limpeza geral"],
  sala: ["Piso", "Rodapes", "Paredes/pintura", "Teto/forro", "Portas/ferragens", "Janelas/vidros", "Tomadas/interruptores", "Iluminacao", "Limpeza geral"],
  cozinha: ["Piso", "Paredes/revestimento", "Teto", "Pia/bancada", "Armarios", "Torneira/sifao", "Fogao/cooktop", "Coifa/depurador", "Pontos de gas", "Tomadas", "Iluminacao", "Ralos/rejuntes", "Limpeza geral"],
  servico: ["Piso", "Paredes", "Tanque", "Torneira", "Ponto maquina", "Aquecedor", "Varal", "Janela", "Iluminacao", "Limpeza geral"],
  banheiro: ["Piso", "Paredes/azulejos", "Teto", "Porta/ferragem", "Vaso sanitario", "Caixa acoplada", "Cuba/lavatorio", "Torneira", "Espelho", "Box/vidro", "Chuveiro", "Ducha higienica", "Ralo/rejunte", "Iluminacao", "Limpeza geral"],
  quarto: ["Piso", "Rodapes", "Paredes/pintura", "Teto", "Porta/ferragem", "Janelas/vidros", "Armarios", "Tomadas/interruptores", "Iluminacao", "Ponto ar condicionado", "Limpeza geral"],
  sacada: ["Piso", "Guarda-corpo", "Teto", "Paredes", "Ralo", "Iluminacao", "Limpeza geral"],
  garagem: ["Piso", "Portao/motor", "Controle remoto", "Iluminacao", "Limpeza geral"],
  outros: ["Item 1", "Item 2", "Item 3"],
};

const SUBJECTIVE_WORDS = ["bonito", "feio", "lindo", "horrivel", "agradavel", "ruim demais"];

const uid = () => `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const formatDate = (value: number | string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));

const formatDateShort = (value: number | string | Date) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    value instanceof Date ? value : new Date(value)
  );

const sanitizeObjective = (text: string) => {
  let output = text;
  SUBJECTIVE_WORDS.forEach((word) => {
    output = output.replace(new RegExp(`\\b${word}\\b`, "gi"), "[termo subjetivo removido]");
  });
  return output;
};

const initialEnvironments = (): Record<EnvironmentId, EnvironmentData> => {
  const result = {} as Record<EnvironmentId, EnvironmentData>;
  ENV_CONFIG.forEach((env) => {
    result[env.id] = {
      checklist: CHECKLIST_CONFIG[env.id].map((item) => ({
        item,
        status: "",
        obs: "",
        paintingState: "",
        gateMaterial: "",
      })),
      observations: "",
      photos: [],
    };
  });
  return result;
};

const blankInspection = (inspector: string, companyId: string): Inspection => ({
  id: `V${uid()}`,
  companyId,
  type: "entrada",
  propertyId: "",
  contractId: "",
  client: "",
  address: "",
  propertyType: "",
  responsible: "",
  inspector,
  finishLevel: "medio",
  legalTerms:
    "Laudo elaborado com linguagem tecnica, imparcial e objetiva, conforme Lei 8.245/91 e boas praticas de vistoria locaticia.",
  complements: "",
  concluded: false,
  createdAt: Date.now(),
  environmentOrder: ENV_CONFIG.map((env) => env.id),
  environments: initialEnvironments(),
  signatures: [
    { role: "proprietario", name: "", accepted: false },
    { role: "inquilino", name: "", accepted: false },
    { role: "vistoriador", name: "", accepted: false },
  ],
});

async function hashSignature(content: string) {
  if (!globalThis.crypto?.subtle) return `hash-${uid()}`;
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function openPhotoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePhotoBlob(
  id: string,
  blob: Blob,
  evidenceType: EvidenceType = "photo",
  durationSeconds?: number,
  companyId?: string
) {
  const db = await openPhotoDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put({
      id,
      blob,
      createdAt: Date.now(),
      evidenceType,
      category: evidenceType === "video" ? "video_evidence" : "photo_evidence",
      durationSeconds,
      companyId: companyId || "",
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deletePhotoBlob(id: string) {
  const db = await openPhotoDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function syncChecklistToSupabase(inspection: Inspection) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const checklistPayload = inspection.environmentOrder.flatMap((envId) =>
    inspection.environments[envId].checklist.map((row) => ({
      inspection_id: inspection.id,
      company_id: inspection.companyId,
      environment_id: envId,
      item_name: row.item,
      status_code: row.status || null,
      obs_text: row.obs || null,
      pintura_estado: row.paintingState || null,
      material_tipo: row.gateMaterial || null,
      updated_at: new Date().toISOString(),
    }))
  );

  if (!checklistPayload.length) return;

  await fetch(`${SUPABASE_URL}/rest/v1/vistorias_checklist`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(checklistPayload),
  }).catch(() => undefined);
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function compressToWebp(source: Blob, quality = 0.8) {
  const imageBitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao comprimir imagem");
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar WebP"));
      },
      "image/webp",
      quality
    );
  });
  imageBitmap.close();
  return compressed;
}

type ContinuousCameraProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  onVideoMode: () => void;
};

function ContinuousCamera({ open, onClose, onCapture, onVideoMode }: ContinuousCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() || {}) as { torch?: boolean };
        setTorchSupported(Boolean(capabilities.torch));
        setError("");
      } catch {
        setError("Nao foi possivel acessar a camera.");
      }
    };

    void start();

    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      setTorchOn(false);
    };
  }, [open]);

  if (!open) return null;

  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorch } as MediaTrackConstraintSet] });
      setTorchOn(nextTorch);
    } catch {
      setError("Lanterna nao suportada neste dispositivo.");
    }
  };

  const capture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.95
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/90 p-4">
      <div className="mx-auto flex h-full w-full max-w-xl flex-col gap-3">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full rounded-lg border border-slate-700 object-cover" />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" type="button" onClick={onClose}>Fechar camera</button>
          <button className="btn-secondary flex-1" type="button" onClick={onVideoMode}>Modo video ({MAX_VIDEO_SECONDS}s)</button>
          {torchSupported && (
            <button className="btn-secondary flex-1" type="button" onClick={toggleTorch}>
              {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            </button>
          )}
          <button className="btn-primary flex-1" type="button" onClick={capture}>Capturar</button>
        </div>
      </div>
    </div>
  );
}

type InspectionWizardProps = {
  wizard: Inspection;
  selectedEnvironment: { id: EnvironmentId; name: string };
  currentEnvironment: number;
  setCurrentEnvironment: (next: number) => void;
  syncWizard: (next: Inspection) => void;
  assistantText: (envId: EnvironmentId) => void;
  uploadPhotos: (event: ChangeEvent<HTMLInputElement>, envId: EnvironmentId) => Promise<void>;
  setCameraOpen: (open: boolean) => void;
  onNextStep: () => void;
  validateEnvironmentBeforeAdvance: (envId: EnvironmentId) => string[];
  removeEnvironment: (envId: EnvironmentId) => void;
  removePhoto: (envId: EnvironmentId, photoId: string) => void;
  showToast: (message: string, type?: ToastType) => void;
};

function InspectionWizard({
  wizard,
  selectedEnvironment,
  currentEnvironment,
  setCurrentEnvironment,
  syncWizard,
  assistantText,
  uploadPhotos,
  setCameraOpen,
  onNextStep,
  validateEnvironmentBeforeAdvance,
  removeEnvironment,
  removePhoto,
  showToast,
}: InspectionWizardProps) {
  const activeEnvironments = wizard.environmentOrder
    .map((id) => ENV_CONFIG.find((env) => env.id === id))
    .filter(Boolean) as { id: EnvironmentId; name: string }[];

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {activeEnvironments.map((env, index) => {
          const data = wizard.environments[env.id];
          const completed = data.checklist.filter((item) => item.status !== "").length;
          const critical = data.checklist.filter((item) => item.status === "av" || item.status === "in").length;
          return (
            <article key={env.id} className={index === currentEnvironment ? "relative rounded-md border border-cyan-400 bg-cyan-500/10 p-3" : "relative rounded-md border border-slate-700 p-3"}>
              <button type="button" className="w-full text-left" onClick={() => setCurrentEnvironment(index)}>
                <p className="font-medium">{env.name}</p>
                <p className="text-xs text-slate-400">{completed}/{data.checklist.length} itens | {data.photos.length}/{MIN_PHOTOS} fotos | {critical} criticos</p>
              </button>
              {activeEnvironments.length > 1 && (
                <button type="button" className="absolute right-2 top-2 rounded-full border border-slate-600 px-2 py-0.5 text-xs hover:border-rose-400 hover:text-rose-300" onClick={() => removeEnvironment(env.id)}>
                  -
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{selectedEnvironment.name}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              const next: Inspection = {
                ...wizard,
                environments: {
                  ...wizard.environments,
                  [selectedEnvironment.id]: {
                    ...wizard.environments[selectedEnvironment.id],
                    checklist: wizard.environments[selectedEnvironment.id].checklist.map((item) => ({
                      ...item,
                      status: item.status || "ok",
                    })),
                  },
                },
              };
              syncWizard(next);
            }}
          >
            Marcar todos como OK
          </button>
          <button className="btn-secondary" type="button" onClick={() => assistantText(selectedEnvironment.id)}>Assistente de vistoria</button>
        </div>
      </div>

      <div className="space-y-2">
        {wizard.environments[selectedEnvironment.id].checklist.map((row, rowIndex) => (
          <article key={row.item} className="rounded-md border border-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{row.item}</p>
              <span className="text-xs text-slate-400">{row.status ? row.status.toUpperCase() : "-"}</span>
            </div>
            {(requiresPaintingState(row.item) || isGateItem(row.item)) && (
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
                {requiresPaintingState(row.item) && (
                  <select
                    className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
                    value={row.paintingState}
                    onChange={(e) => {
                      const next: Inspection = {
                        ...wizard,
                        environments: {
                          ...wizard.environments,
                          [selectedEnvironment.id]: {
                            ...wizard.environments[selectedEnvironment.id],
                            checklist: wizard.environments[selectedEnvironment.id].checklist.map((item, idx) =>
                              idx === rowIndex
                                ? { ...item, paintingState: e.target.value as PaintingState }
                                : item
                            ),
                          },
                        },
                      };
                      syncWizard(next);
                    }}
                  >
                    <option value="">Pintura</option>
                    <option value="nova">NOVA</option>
                    <option value="usada">USADA</option>
                  </select>
                )}

                {isGateItem(row.item) && (
                  <select
                    className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
                    value={row.gateMaterial}
                    onChange={(e) => {
                      const next: Inspection = {
                        ...wizard,
                        environments: {
                          ...wizard.environments,
                          [selectedEnvironment.id]: {
                            ...wizard.environments[selectedEnvironment.id],
                            checklist: wizard.environments[selectedEnvironment.id].checklist.map((item, idx) =>
                              idx === rowIndex
                                ? { ...item, gateMaterial: e.target.value as GateMaterial }
                                : item
                            ),
                          },
                        },
                      };
                      syncWizard(next);
                    }}
                  >
                    <option value="">Material do portao</option>
                    <option value="madeira">Madeira</option>
                    <option value="ferro">Ferro</option>
                    <option value="aluminio">Aluminio</option>
                    <option value="pvc">PVC</option>
                  </select>
                )}
              </div>
            )}
            <div className="mb-2 flex flex-wrap gap-1">
              {(["ok", "dn", "av", "in", "na", "ni"] as ChecklistStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={row.status === status ? "status-selected" : "status-chip"}
                  onClick={() => {
                    const nextStatus: ChecklistStatus = row.status === status ? "" : status;
                    if (nextStatus === "") showToast("Status resetado.", "info");
                    const next: Inspection = {
                      ...wizard,
                      environments: {
                        ...wizard.environments,
                        [selectedEnvironment.id]: {
                          ...wizard.environments[selectedEnvironment.id],
                          checklist: wizard.environments[selectedEnvironment.id].checklist.map((item, idx) =>
                            idx === rowIndex ? { ...item, status: nextStatus } : item
                          ),
                        },
                      },
                    };
                    syncWizard(next);
                  }}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              className="field"
              placeholder="Observacao do item"
              value={row.obs}
              onChange={(e) => {
                const next: Inspection = {
                  ...wizard,
                  environments: {
                    ...wizard.environments,
                    [selectedEnvironment.id]: {
                      ...wizard.environments[selectedEnvironment.id],
                      checklist: wizard.environments[selectedEnvironment.id].checklist.map((item, idx) =>
                        idx === rowIndex ? { ...item, obs: e.target.value } : item
                      ),
                    },
                  },
                };
                syncWizard(next);
              }}
            />
          </article>
        ))}
      </div>

      <textarea
        className="field min-h-24"
        placeholder="Observacoes gerais do ambiente"
        value={wizard.environments[selectedEnvironment.id].observations}
        onChange={(e) => {
          const next: Inspection = {
            ...wizard,
            environments: {
              ...wizard.environments,
              [selectedEnvironment.id]: {
                ...wizard.environments[selectedEnvironment.id],
                observations: e.target.value,
              },
            },
          };
          syncWizard(next);
        }}
      />

      <label className="text-sm text-slate-300">
        Fotos do ambiente ({wizard.environments[selectedEnvironment.id].photos.length}/{MIN_PHOTOS})
        <input className="mt-2 block w-full text-sm" type="file" multiple accept="image/*" onChange={(event) => void uploadPhotos(event, selectedEnvironment.id)} />
      </label>

      <div className="flex flex-wrap gap-2 text-sm">
        <button className="btn-camera" type="button" onClick={() => setCameraOpen(true)}>
          <span>📷</span>
          <span>Abrir camera continua</span>
        </button>
        {wizard.environments[selectedEnvironment.id].photos.length < MIN_PHOTOS && (
          <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-300">
            Baixa evidencia: recomendado minimo de {MIN_PHOTOS} fotos neste ambiente.
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {wizard.environments[selectedEnvironment.id].photos
          .sort((a, b) => a.addedAt - b.addedAt)
          .map((photo, photoIndex) => (
            <figure key={photo.id} className="relative space-y-1">
              {photo.evidenceType === "video" ? (
                <video src={photo.url} className="h-24 w-full rounded border border-slate-700 object-cover" />
              ) : (
                <img src={photo.url} alt={photo.name} className="h-24 w-full rounded border border-slate-700 object-cover" />
              )}
              {photo.evidenceType === "video" && (
                <span className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
                  PLAY
                </span>
              )}
              <figcaption className="text-xs text-slate-400">{photoIndex + 1}. {photo.name}</figcaption>
              <button type="button" className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white hover:bg-rose-600" onClick={() => removePhoto(selectedEnvironment.id, photo.id)}>
                X
              </button>
            </figure>
          ))}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn-secondary" type="button" onClick={() => setCurrentEnvironment(Math.max(currentEnvironment - 1, 0))}>Anterior</button>
        <button className="btn-primary" type="button" onClick={() => {
          const envErrors = validateEnvironmentBeforeAdvance(selectedEnvironment.id);
          if (envErrors.length) {
            showToast(envErrors[0], "warning");
            return;
          }
          if (currentEnvironment === activeEnvironments.length - 1) onNextStep();
          else setCurrentEnvironment(currentEnvironment + 1);
        }}>Proximo</button>
      </div>
    </div>
  );
}

type CompanySelectorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
};

function CompanySelector({ value, onChange, label = "Imobiliaria", disabled = false }: CompanySelectorProps) {
  return (
    <label className="flex min-w-[220px] flex-col gap-1 text-xs text-slate-300">
      <span>{label}</span>
      <select
        className="field h-9"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione a imobiliaria</option>
        {COMPANIES.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name} - {company.city}
          </option>
        ))}
      </select>
    </label>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [session, setSession] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [owners, setOwners] = useState<Owner[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [sessionCompanyLock, setSessionCompanyLock] = useState("");
  const [dashboardCompanyFilter, setDashboardCompanyFilter] = useState("all");

  const [wizard, setWizard] = useState<Inspection | null>(null);
  const wizardRef = useRef<Inspection | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [currentEnvironment, setCurrentEnvironment] = useState(0);

  const [feedback, setFeedback] = useState("");

  const [ownerForm, setOwnerForm] = useState({ name: "", document: "" });
  const [tenantForm, setTenantForm] = useState({ name: "", document: "" });
  const [propertyForm, setPropertyForm] = useState({ code: "", address: "", ownerId: "", finishLevel: "medio" as FinishLevel });
  const [contractForm, setContractForm] = useState({ code: "", propertyId: "", tenantId: "" });

  const [compare, setCompare] = useState({ propertyId: "", entradaId: "", saidaId: "" });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoWarning, setPhotoWarning] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2200);
  };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as {
      owners: Owner[];
      tenants: Tenant[];
      properties: Property[];
      contracts: Contract[];
      inspections: Inspection[];
    };
    setOwners(data.owners || []);
    setTenants(data.tenants || []);
    setProperties(data.properties || []);
    setContracts(data.contracts || []);
    setInspections(
      (data.inspections || []).map((inspection) => ({
        ...inspection,
        companyId: inspection.companyId || "",
        environmentOrder:
          inspection.environmentOrder && inspection.environmentOrder.length
            ? inspection.environmentOrder
            : ENV_CONFIG.map((env) => env.id),
        environments: Object.fromEntries(
          Object.entries(inspection.environments).map(([envId, envData]) => [
            envId,
            {
              ...envData,
              checklist: (envData.checklist || []).map((row) => ({
                ...row,
                paintingState: row.paintingState || "",
                gateMaterial: row.gateMaterial || "",
              })),
              photos: (envData.photos || []).map((photo) => ({ ...photo, evidenceType: photo.evidenceType || "photo" })),
            },
          ])
        ) as Record<EnvironmentId, EnvironmentData>,
      }))
    );
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return;
    const remembered = JSON.parse(raw) as { email: string; password: string; enabled: boolean };
    if (!remembered.enabled) return;
    setRememberLogin(true);
    setLoginForm({ email: remembered.email, password: remembered.password });
    const found = USERS.find((item) => item.email === remembered.email && item.password === remembered.password);
    if (found) setSession(found);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owners, tenants, properties, contracts, inspections }));
  }, [owners, tenants, properties, contracts, inspections]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    setInspections((prev) => prev.map((item) => (item.syncedAt ? item : { ...item, syncedAt: new Date().toISOString() })));
  }, [isOnline]);

  useEffect(() => {
    wizardRef.current = wizard;
  }, [wizard]);

  const syncWizard = (next: Inspection) => {
    wizardRef.current = next;
    setWizard(next);
    setInspections((prev) => {
      const has = prev.some((item) => item.id === next.id);
      if (!has) return [next, ...prev];
      return prev.map((item) => (item.id === next.id ? next : item));
    });
    void syncChecklistToSupabase(next);
  };

  const startNewInspection = () => {
    if (!session) return;
    if (!selectedCompanyId && !sessionCompanyLock) {
      showToast("Selecione a imobiliaria antes de iniciar a vistoria.", "warning");
      return;
    }
    const lockedCompany = sessionCompanyLock || selectedCompanyId;
    if (sessionCompanyLock && selectedCompanyId && selectedCompanyId !== sessionCompanyLock) {
      showToast("Sessao vinculada a uma unica imobiliaria. Selecao foi restaurada.", "warning");
      setSelectedCompanyId(sessionCompanyLock);
    }
    if (!sessionCompanyLock) {
      setSessionCompanyLock(lockedCompany);
      setSelectedCompanyId(lockedCompany);
    }

    const created = blankInspection(session.name, lockedCompany);
    syncWizard(created);
    setStep(1);
    setCurrentEnvironment(0);
    setActiveTab("vistoria");
    showToast("Nova vistoria iniciada.", "info");
  };

  const selectCompanyForSession = (companyId: string) => {
    if (sessionCompanyLock && companyId !== sessionCompanyLock) {
      showToast("Imobiliaria travada nesta sessao. Finalize ou saia para trocar.", "warning");
      return;
    }
    setSelectedCompanyId(companyId);
  };

  const companyNameById = (id: string) => COMPANIES.find((company) => company.id === id)?.name || "nao informado";

  const filteredInspections = useMemo(() => {
    const normalized = search.toLowerCase();
    return [...inspections]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (item) =>
          (dashboardCompanyFilter === "all" || item.companyId === dashboardCompanyFilter) &&
          (
            item.client.toLowerCase().includes(normalized) ||
            item.address.toLowerCase().includes(normalized) ||
            item.id.toLowerCase().includes(normalized)
          )
      );
  }, [dashboardCompanyFilter, inspections, search]);

  const stats = useMemo(() => {
    const total = inspections.length;
    const entrada = inspections.filter((item) => item.type === "entrada").length;
    const saida = inspections.filter((item) => item.type === "saida").length;
    const mobiliado = inspections.filter((item) => item.type === "mobiliado").length;
    return { total, entrada, saida, mobiliado };
  }, [inspections]);

  const performance = useMemo(() => {
    if (!inspections.length) return { avgPhotos: 0, quality: 0 };
    const totalPhotos = inspections.reduce(
      (sum, inspection) =>
        sum + ENV_CONFIG.reduce((envAcc, env) => envAcc + inspection.environments[env.id].photos.length, 0),
      0
    );
    const quality = inspections
      .map((inspection) => {
        const totalItems = ENV_CONFIG.reduce(
          (count, env) => count + inspection.environments[env.id].checklist.length,
          0
        );
        const filledItems = ENV_CONFIG.reduce(
          (count, env) =>
            count + inspection.environments[env.id].checklist.filter((item) => item.status !== "").length,
          0
        );
        return totalItems ? (filledItems / totalItems) * 100 : 0;
      })
      .reduce((acc, value) => acc + value, 0);
    return { avgPhotos: totalPhotos / inspections.length, quality: quality / inspections.length };
  }, [inspections]);

  const selectedEnvironment = wizard
    ? ENV_CONFIG.find((env) => env.id === wizard.environmentOrder[currentEnvironment]) || null
    : null;

  const comparison = useMemo(() => {
    const entrada = inspections.find((item) => item.id === compare.entradaId);
    const saida = inspections.find((item) => item.id === compare.saidaId);
    if (!entrada || !saida) return [];

    return ENV_CONFIG.map((env) => {
      const left = entrada.environments[env.id];
      const right = saida.environments[env.id];
      const issuesLeft = left.checklist.filter((item) => item.status === "av" || item.status === "in").length;
      const issuesRight = right.checklist.filter((item) => item.status === "av" || item.status === "in").length;
      const changedStatuses = right.checklist.filter(
        (item, index) => item.status !== left.checklist[index].status
      ).length;

      const changes: string[] = [];
      if (changedStatuses) changes.push(`${changedStatuses} itens alterados`);
      if (issuesRight > issuesLeft) changes.push(`aumento de inconformidades (${issuesLeft} -> ${issuesRight})`);
      if (right.photos.length !== left.photos.length)
        changes.push(`fotos (${left.photos.length} -> ${right.photos.length})`);
      if (!changes.length) changes.push("sem divergencias relevantes");

      return { environment: env.name, changed: changes[0] !== "sem divergencias relevantes", summary: changes.join("; ") };
    });
  }, [compare, inspections]);

  const editInspection = (inspection: Inspection) => {
    setWizard(inspection);
    setSelectedCompanyId(inspection.companyId || "");
    if (!sessionCompanyLock && inspection.companyId) {
      setSessionCompanyLock(inspection.companyId);
    }
    setStep(2);
    setCurrentEnvironment(0);
    setActiveTab("vistoria");
  };

  const removeInspection = (id: string) => {
    setInspections((prev) => prev.filter((item) => item.id !== id));
    if (wizard?.id === id) setWizard(null);
  };

  const validateStepOne = (candidate: Inspection) => {
    if (!candidate.companyId || !candidate.client || !candidate.address || !candidate.type) {
      setFeedback("Preencha imobiliaria, tipo de vistoria, cliente e endereco para avancar.");
      return false;
    }
    setFeedback("");
    return true;
  };

  const validateConclusion = (candidate: Inspection) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!validateStepOne(candidate)) errors.push("dados iniciais incompletos");

    const activeEnvironments = candidate.environmentOrder
      .map((id) => ENV_CONFIG.find((env) => env.id === id))
      .filter(Boolean) as { id: EnvironmentId; name: string }[];

    activeEnvironments.forEach((env) => {
      const data = candidate.environments[env.id];
      const emptyStatuses = data.checklist.filter((item) => item.status === "").length;
      const criticalItems = data.checklist.filter((item) => item.status === "av" || item.status === "in");
      const attributeValidation = validateChecklistAttributes(data.checklist);
      if (emptyStatuses) errors.push(`${env.name}: checklist incompleto`);
      if (!attributeValidation.isValid) {
        attributeValidation.errors.forEach((err) => errors.push(`${env.name}: ${err}`));
      }
      if (criticalItems.length > 0 && data.photos.length < MIN_PHOTOS) {
        errors.push(`${env.name}: minimo de ${MIN_PHOTOS} fotos obrigatorio por AV/IN`);
      }
      if (criticalItems.length === 0 && data.photos.length < MIN_PHOTOS) {
        warnings.push(`${env.name}: baixa evidencia fotografica (${data.photos.length}/${MIN_PHOTOS})`);
      }
      if (SUBJECTIVE_WORDS.some((word) => data.observations.toLowerCase().includes(word))) {
        errors.push(`${env.name}: linguagem subjetiva detectada`);
      }
    });

    candidate.signatures.forEach((signature) => {
      if (!signature.accepted || !signature.name.trim()) {
        errors.push(`assinatura obrigatoria de ${signature.role}`);
      }
    });
    return { errors, warnings };
  };

  const processPhotoBlob = async (
    blob: Blob,
    envId: EnvironmentId,
    name = `foto-${Date.now()}`,
    evidenceType: EvidenceType = "photo",
    durationSeconds?: number
  ) => {
    const currentWizard = wizardRef.current;
    if (!currentWizard) return;
    const compressed = evidenceType === "photo" ? await compressToWebp(blob) : blob;
    const blobId = uid();
    await savePhotoBlob(blobId, compressed, evidenceType, durationSeconds, currentWizard.companyId);
    const url = await blobToDataUrl(compressed);

    const photo: Photo = {
      id: uid(),
      name: evidenceType === "video" ? `${name}.webm` : `${name}.webp`,
      url,
      addedAt: Date.now(),
      blobId,
      evidenceType,
      durationSeconds,
    };

    const next: Inspection = {
      ...currentWizard,
      environments: {
        ...currentWizard.environments,
        [envId]: {
          ...currentWizard.environments[envId],
          photos: [...currentWizard.environments[envId].photos, photo],
        },
      },
    };
    syncWizard(next);
  };

  const uploadPhotos = async (event: ChangeEvent<HTMLInputElement>, envId: EnvironmentId) => {
    if (!wizard) return;
    const files = event.target.files;
    if (!files?.length) return;
    const allowed = Array.from(files).filter((file) => file.size <= 5 * 1024 * 1024);
    for (const file of allowed) {
      // Compressao WebP no cliente antes do armazenamento.
      await processPhotoBlob(file, envId, file.name.replace(/\.[^.]+$/, ""));
    }
    showToast(`${allowed.length} foto(s) registrada(s).`, "success");
    event.target.value = "";
  };

  const assistantText = (envId: EnvironmentId) => {
    if (!wizard) return;
    const data = wizard.environments[envId];
    const critical = data.checklist.filter((item) => item.status === "av" || item.status === "in").length;
    const suggestion = sanitizeObjective(
      `Ambiente com ${data.photos.length} fotos registradas. Foram identificados ${critical} itens em nao conformidade. Descrever revestimentos, funcionamento eletrico e hidraulico, acabamentos e sinais de desgaste de forma tecnica e objetiva.`
    );
    const next: Inspection = {
      ...wizard,
      environments: {
        ...wizard.environments,
        [envId]: {
          ...data,
          observations: `${data.observations}${data.observations ? "\n" : ""}${suggestion}`,
        },
      },
    };
    syncWizard(next);
  };

  const handleCameraCapture = async (blob: Blob) => {
    if (!selectedEnvironment) return;
    await processPhotoBlob(blob, selectedEnvironment.id, `${selectedEnvironment.name.toLowerCase()}-camera`);
    showToast("Foto registrada!", "success");
  };

  const removePhoto = async (envId: EnvironmentId, photoId: string) => {
    if (!wizard) return;
    const target = wizard.environments[envId].photos.find((photo) => photo.id === photoId);
    if (target?.blobId) await deletePhotoBlob(target.blobId);
    const next: Inspection = {
      ...wizard,
      environments: {
        ...wizard.environments,
        [envId]: {
          ...wizard.environments[envId],
          photos: wizard.environments[envId].photos.filter((photo) => photo.id !== photoId),
        },
      },
    };
    syncWizard(next);
    showToast("Foto removida.", "info");
  };

  const removeEnvironment = (envId: EnvironmentId) => {
    if (!wizard) return;
    const envName = ENV_CONFIG.find((env) => env.id === envId)?.name || envId;
    const confirmed = window.confirm(`Remover ambiente ${envName}? Itens e fotos serao limpos.`);
    if (!confirmed) return;

    wizard.environments[envId].photos.forEach((photo) => {
      if (photo.blobId) void deletePhotoBlob(photo.blobId);
    });

    const nextOrder = wizard.environmentOrder.filter((id) => id !== envId);
    const next: Inspection = {
      ...wizard,
      environmentOrder: nextOrder,
      environments: {
        ...wizard.environments,
        [envId]: {
          checklist: [],
          observations: "",
          photos: [],
        },
      },
    };
    syncWizard(next);
    setCurrentEnvironment((prev) => Math.max(0, Math.min(prev, nextOrder.length - 1)));
    showToast(`Ambiente ${envName} removido.`, "warning");
  };

  const validateEnvironmentBeforeAdvance = (envId: EnvironmentId) => {
    if (!wizard) return [];
    const rows = wizard.environments[envId].checklist;
    const invalid = validateChecklistAttributes(rows);
    return invalid.errors;
  };

  const completeInspection = async () => {
    if (!wizard) return;
    const { errors, warnings } = validateConclusion(wizard);
    if (errors.length) {
      setFeedback(`Validacao antigambe: ${errors.slice(0, 3).join(" | ")}`);
      return;
    }
    if (warnings.length) {
      setPhotoWarning(warnings.slice(0, 4).join(" | "));
    }

    const signed = await Promise.all(
      wizard.signatures.map(async (signature) => {
        const timestamp = new Date().toISOString();
        const hash = await hashSignature(`${wizard.id}:${signature.role}:${signature.name}:${timestamp}`);
        return { ...signature, timestamp, hash };
      })
    );

    const normalized: Inspection = {
      ...wizard,
      legalTerms: sanitizeObjective(wizard.legalTerms),
      complements: sanitizeObjective(wizard.complements),
      concluded: true,
      concludedAt: Date.now(),
      signatures: signed,
      syncedAt: isOnline ? new Date().toISOString() : undefined,
    };

    syncWizard(normalized);
    setFeedback(
      isOnline ? "Vistoria concluida e sincronizada." : "Vistoria concluida offline. Sera sincronizada ao reconectar."
    );
    showToast("Vistoria concluida e salva.", "success");
    setActiveTab("timeline");
  };

  const exportReport = (inspection: Inspection) => {
    const owner = properties.find((item) => item.id === inspection.propertyId)?.ownerId;
    const ownerName = owners.find((item) => item.id === owner)?.name || "nao informado";
    const contract = contracts.find((item) => item.id === inspection.contractId);
    const tenantName = tenants.find((item) => item.id === contract?.tenantId)?.name || "nao informado";
    const companyName = companyNameById(inspection.companyId);

    const activeEnvironments = inspection.environmentOrder
      .map((id) => ENV_CONFIG.find((env) => env.id === id))
      .filter(Boolean) as { id: EnvironmentId; name: string }[];

    const criticalEntries = activeEnvironments.flatMap((env) =>
      inspection.environments[env.id].checklist
        .filter((row) => row.status === "av" || row.status === "in")
        .map((row) => ({ envName: env.name, row }))
    );

    const logoUrl = `${window.location.origin}/images/logo-redemais.png`;
    const reportDate = formatDate(inspection.createdAt);

    const renderHeader = () => `
      <header class="brand-header">
        <div class="brand-wrap">
          <img src="${logoUrl}" alt="Redemais Vistorias" class="brand-logo" />
          <p class="brand-title">Redemais Vistorias</p>
        </div>
        <p class="header-company">${companyName}</p>
      </header>
      <div class="brand-divider"></div>
    `;

    const executiveSummary = criticalEntries.length
      ? criticalEntries
          .map(
            (entry) =>
              `<tr class="critical-row"><td>${entry.envName}</td><td>${entry.row.item}</td><td class="status-critical">${entry.row.status?.toUpperCase()}</td><td>${formatChecklistObservation(entry.row) || "Sem observacao"}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="status-ok">Nenhuma pendencia critica (AV/IN) identificada.</td></tr>`;

    const environmentsPages = activeEnvironments
      .map((env) => {
        const data = inspection.environments[env.id];
        const criticalRows = data.checklist.filter((row) => row.status === "av" || row.status === "in");
        const checklistRows = data.checklist
          .map((row) => {
            const obsText = formatChecklistObservation(row);
            return `<tr><td>${row.item}</td><td>${row.status ? row.status.toUpperCase() : "-"}</td><td>${obsText || ""}</td></tr>`;
          })
          .join("");

        const evidenceCards = data.photos
          .sort((a, b) => a.addedAt - b.addedAt)
          .map((media, mediaIndex) => {
            const related = criticalRows.length
              ? criticalRows[mediaIndex % criticalRows.length].item
              : data.checklist[mediaIndex % Math.max(data.checklist.length, 1)]?.item || "Registro geral";

            if (media.evidenceType === "video") {
              return `
                <figure class="media-card">
                  <div class="video-thumb">
                    <span class="play-badge">PLAY</span>
                  </div>
                  <figcaption>${env.name} - ${related} - video (${media.durationSeconds || 0}s)</figcaption>
                </figure>
              `;
            }

            return `
              <figure class="media-card">
                <img src="${media.url}" alt="${env.name} ${mediaIndex + 1}" />
                <figcaption>${env.name} - ${related} - foto ${mediaIndex + 1}</figcaption>
              </figure>
            `;
          })
          .join("");

        return `
          <section class="environment-section">
            <h2 class="section-title">Ambiente: ${env.name}</h2>
            <table class="checklist-table">
              <thead><tr><th>Item</th><th>Status</th><th>Observacao</th></tr></thead>
              <tbody>${checklistRows}</tbody>
            </table>
            <p class="environment-notes"><strong>Observacoes gerais:</strong> ${data.observations || "Sem observacoes."}</p>
            <h3 class="media-title">Evidencias fotografias e videos</h3>
            <div class="media-grid">${evidenceCards || "<p>Sem evidencias registradas.</p>"}</div>
          </section>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Laudo ${inspection.id}</title>
          <style>
            @page { size: A4; margin: 12mm 10mm; }
            body { font-family: Inter, Roboto, Arial, sans-serif; color: #0f172a; margin: 0; }
            .cover-page { page-break-after: always; min-height: 260mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 14px; }
            .doc-content { padding-top: 20mm; padding-bottom: 12mm; }
            .brand-header { position: fixed; top: 0; left: 0; right: 0; background: #ffffff; padding: 6mm 10mm 2mm; display: flex; align-items: center; justify-content: space-between; z-index: 2; }
            .brand-wrap { display: flex; align-items: center; gap: 10px; }
            .brand-logo { width: 34px; height: 34px; border-radius: 999px; object-fit: cover; }
            .brand-title { margin: 0; font-size: 13px; font-weight: 700; color: #0b4f97; }
            .header-company { margin: 0; font-size: 11px; font-weight: 700; color: #334155; }
            .brand-divider { position: fixed; top: 19mm; left: 10mm; right: 10mm; border-bottom: 1.5px solid #0b4f97; z-index: 2; }
            .page-footer { position: fixed; left: 10mm; right: 10mm; bottom: 0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; border-top: 1px solid #cbd5e1; padding: 4px 0; background: #fff; }
            .page-counter::after { content: "Pagina " counter(page) " de " counter(pages); }
            .cover-logo { width: 140px; height: 140px; border-radius: 999px; object-fit: cover; }
            .cover-title { font-size: 24px; font-weight: 800; color: #0b4f97; margin: 0; letter-spacing: 0.3px; }
            .cover-sub { font-size: 14px; color: #334155; margin: 0; }
            .cover-block { width: 100%; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 14px; text-align: left; }
            .cover-label { font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; }
            .cover-value { margin-top: 2px; font-size: 16px; font-weight: 700; color: #0f172a; }
            .section-title { font-size: 15px; color: #0b4f97; margin: 0 0 8px; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
            .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
            .summary-card span { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .summary-card strong { font-size: 14px; color: #0f172a; }
            .critical-table, .checklist-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
            .critical-table th, .critical-table td, .checklist-table th, .checklist-table td { border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 10px; text-align: left; }
            .critical-table th, .checklist-table th { background: #f1f5f9; font-weight: 700; }
            .checklist-table tr { page-break-inside: avoid; }
            .status-critical { color: #b91c1c; font-weight: 700; }
            .critical-row td { color: #991b1b; font-weight: 700; background: #fff1f2; }
            .status-ok { color: #047857; font-weight: 700; text-align: center; }
            .environment-notes { font-size: 10px; margin: 6px 0; line-height: 1.45; }
            .media-title { margin: 6px 0; font-size: 12px; color: #0b4f97; }
            .media-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
            .media-card { margin: 0; page-break-inside: avoid; }
            .media-card img, .video-thumb { width: 100%; height: 80px; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 6px; background: #e2e8f0; }
            .video-thumb { display: flex; align-items: center; justify-content: center; background: #cbd5e1; }
            .play-badge { border-radius: 999px; background: rgba(15, 23, 42, 0.82); color: white; font-size: 10px; padding: 4px 8px; }
            .media-card figcaption { font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.35; }
            .environment-section { margin: 8px 0 10px; page-break-inside: auto; }
            .signatures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; page-break-inside: avoid; }
            .sign-box { border-top: 1px solid #334155; padding-top: 8px; font-size: 11px; }
            .sign-line { margin-top: 12px; border-top: 1px dashed #94a3b8; padding-top: 4px; color: #64748b; }
            .final-section { margin-top: 12px; page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <section class="cover-page">
            <img src="${logoUrl}" alt="Logo Redemais" class="cover-logo" />
            <h1 class="cover-title">LAUDO TECNICO DE VISTORIA IMOBILIARIA</h1>
            <p class="cover-sub">Documento tecnico para uso locaticio e juridico</p>
            <div class="cover-block">
              <p class="cover-label">Endereco completo do imovel</p>
              <p class="cover-value">${inspection.address}</p>
            </div>
            <div class="cover-block">
              <p class="cover-label">Vistoriador responsavel</p>
              <p class="cover-value">${inspection.inspector}</p>
            </div>
          </section>

          ${renderHeader()}
          <div class="brand-divider"></div>
          <footer class="page-footer">
            <span>Data da vistoria: ${reportDate}</span>
            <span class="page-counter"></span>
          </footer>

          <main class="doc-content">
            <h2 class="section-title">Sumario Executivo</h2>
            <div class="summary-grid">
              <div class="summary-card"><span>Codigo do laudo</span><strong>${inspection.id}</strong></div>
              <div class="summary-card"><span>Tipo de vistoria</span><strong>${inspection.type}</strong></div>
              <div class="summary-card"><span>Proprietario</span><strong>${ownerName}</strong></div>
              <div class="summary-card"><span>Inquilino</span><strong>${tenantName}</strong></div>
              <div class="summary-card"><span>Prestado para</span><strong>${companyName}</strong></div>
              <div class="summary-card"><span>Data da vistoria</span><strong>${reportDate}</strong></div>
              <div class="summary-card"><span>Classificacao de acabamento</span><strong>${inspection.finishLevel}</strong></div>
            </div>

            <h3 class="media-title">Pendencias criticas (AV e IN)</h3>
            <table class="critical-table">
              <thead>
                <tr><th>Ambiente</th><th>Item</th><th>Status</th><th>Observacao</th></tr>
              </thead>
              <tbody>${executiveSummary}</tbody>
            </table>
          

          ${environmentsPages}

          <section class="final-section">
            <h2 class="section-title">Termos Finais e Assinaturas</h2>
            <p class="environment-notes">${inspection.legalTerms}</p>
            <p class="environment-notes"><strong>Complementos:</strong> ${inspection.complements || "Sem complementos adicionais."}</p>

            <div class="signatures">
              <div class="sign-box">
                <strong>Vistoriador</strong>
                <div class="sign-line">Nome: ${inspection.inspector}</div>
                <div class="sign-line">CPF: _____________________</div>
                <div class="sign-line">Data: ____/____/________</div>
              </div>
              <div class="sign-box">
                <strong>Locador</strong>
                <div class="sign-line">Nome: ${ownerName}</div>
                <div class="sign-line">CPF: _____________________</div>
                <div class="sign-line">Data: ____/____/________</div>
              </div>
              <div class="sign-box">
                <strong>Locatario</strong>
                <div class="sign-line">Nome: ${tenantName}</div>
                <div class="sign-line">CPF: _____________________</div>
                <div class="sign-line">Data: ____/____/________</div>
              </div>
            </div>
          </section>
          </main>
        </body>
      </html>
    `;

    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => setTimeout(() => popup.print(), 400);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsAuthenticating(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const user = USERS.find((item) => item.email === loginForm.email && item.password === loginForm.password);
    if (!user) {
      setFeedback("Credenciais invalidas.");
      setIsAuthenticating(false);
      showToast("Falha no login.", "error");
      return;
    }
    if (rememberLogin) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ ...loginForm, enabled: true }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    setSession(user);
    setFeedback("");
    setIsAuthenticating(false);
    showToast("Login realizado com sucesso.", "success");
    setActiveTab("dashboard");
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 p-4">
        <div className="fixed right-3 top-3 z-50 space-y-2">
          {toasts.map((toast) => (
            <p key={toast.id} className={toast.type === "success" ? "toast-success" : toast.type === "warning" ? "toast-warning" : toast.type === "error" ? "toast-error" : "toast-info"}>
              {toast.message}
            </p>
          ))}
        </div>
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
          <h1 className="text-2xl font-extrabold text-blue-800">Redemais Vistorias</h1>
          <p className="text-sm text-slate-500">Acesse com seu usuario operacional.</p>
          <input className="field !bg-white !text-slate-900" placeholder="E-mail" value={loginForm.email} onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))} />
          <input className="field !bg-white !text-slate-900" type="password" placeholder="Senha" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={rememberLogin} onChange={(e) => setRememberLogin(e.target.checked)} />
            Lembrar de mim
          </label>
          <button className="btn-primary w-full" disabled={isAuthenticating} type="submit">
            {isAuthenticating ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
          <p className="text-xs text-slate-500">demo: admin@redemais.com.br / 123456</p>
          {feedback && <p className="text-sm text-rose-600">{feedback}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Redemais Vistorias</p>
            <h1 className="text-base font-semibold md:text-xl">Sistema Operacional de Vistorias Locaticias</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={isOnline ? "badge-ok" : "badge-off"}>{isOnline ? "online" : "offline"}</span>
            <span>{session.name}</span>
            <button className="btn-secondary" onClick={() => { setSession(null); setSessionCompanyLock(""); setSelectedCompanyId(""); }} type="button">Sair</button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 py-4 md:px-8">
        {[
          ["dashboard", "Dashboard"],
          ["cadastro", "Cadastro"],
          ["vistoria", "Execucao"],
          ["comparacao", "Comparacao"],
          ["timeline", "Linha do tempo"],
          ["desempenho", "Desempenho"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key as Tab)} className={activeTab === key ? "tab-active" : "tab"}>
            {label}
          </button>
        ))}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8">
        <div className="fixed right-3 top-3 z-50 space-y-2">
          {toasts.map((toast) => (
            <p key={toast.id} className={toast.type === "success" ? "toast-success" : toast.type === "warning" ? "toast-warning" : toast.type === "error" ? "toast-error" : "toast-info"}>
              {toast.message}
            </p>
          ))}
        </div>
        {feedback && <p className="mb-4 rounded-md border border-cyan-800 bg-cyan-950/20 p-3 text-sm">{feedback}</p>}

        {activeTab === "dashboard" && (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-slate-800 p-4"><p className="text-sm text-slate-400">Total</p><p className="text-3xl font-bold text-cyan-300">{stats.total}</p></article>
              <article className="rounded-lg border border-slate-800 p-4"><p className="text-sm text-slate-400">Entrada</p><p className="text-3xl font-bold">{stats.entrada}</p></article>
              <article className="rounded-lg border border-slate-800 p-4"><p className="text-sm text-slate-400">Saida</p><p className="text-3xl font-bold">{stats.saida}</p></article>
              <article className="rounded-lg border border-slate-800 p-4"><p className="text-sm text-slate-400">Mobiliado</p><p className="text-3xl font-bold">{stats.mobiliado}</p></article>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="button" onClick={startNewInspection}>Nova vistoria</button>
              <CompanySelector
                value={selectedCompanyId}
                onChange={selectCompanyForSession}
                label="Imobiliaria ativa para nova vistoria"
                disabled={Boolean(sessionCompanyLock)}
              />
              {sessionCompanyLock && (
                <span className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                  Sessao vinculada: {companyNameById(sessionCompanyLock)}
                </span>
              )}
              <label className="flex min-w-[220px] flex-col gap-1 text-xs text-slate-300">
                <span>Filtro de imobiliaria</span>
                <select className="field h-9" value={dashboardCompanyFilter} onChange={(e) => setDashboardCompanyFilter(e.target.value)}>
                  <option value="all">Todas as vistorias</option>
                  {COMPANIES.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>
              <input className="field max-w-sm" placeholder="Buscar por cliente, endereco ou codigo" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              {filteredInspections.map((inspection) => (
                <article key={inspection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 transition hover:border-cyan-400">
                  <div>
                    <p className="font-semibold">{inspection.client}</p>
                    <p className="text-sm text-slate-400">{inspection.address}</p>
                    <p className="text-xs text-slate-500">{inspection.id} | {companyNameById(inspection.companyId)} | {formatDateShort(inspection.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tab">{inspection.type}</span>
                    <span className={inspection.concluded ? "badge-ok" : "badge-off"}>{inspection.concluded ? "concluida" : "em andamento"}</span>
                    <button className="btn-secondary" type="button" onClick={() => editInspection(inspection)}>Abrir</button>
                    <button className="btn-secondary" type="button" onClick={() => exportReport(inspection)}>PDF</button>
                    <button className="btn-secondary" type="button" onClick={() => removeInspection(inspection.id)}>Excluir</button>
                  </div>
                </article>
              ))}
              {!filteredInspections.length && <p className="text-sm text-slate-400">Nenhuma vistoria encontrada.</p>}
            </div>
          </section>
        )}

        {activeTab === "cadastro" && (
          <section className="grid gap-4 md:grid-cols-2">
            <form className="space-y-2 rounded-lg border border-slate-800 p-4" onSubmit={(e) => { e.preventDefault(); if (!ownerForm.name) return; setOwners((prev) => [{ id: uid(), ...ownerForm }, ...prev]); setOwnerForm({ name: "", document: "" }); showToast("Proprietario salvo.", "success"); }}>
              <h2 className="font-semibold">Proprietarios</h2>
              <input className="field" placeholder="Nome" value={ownerForm.name} onChange={(e) => setOwnerForm((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="field" placeholder="Documento" value={ownerForm.document} onChange={(e) => setOwnerForm((prev) => ({ ...prev, document: e.target.value }))} />
              <button className="btn-primary" type="submit">Salvar</button>
            </form>

            <form className="space-y-2 rounded-lg border border-slate-800 p-4" onSubmit={(e) => { e.preventDefault(); if (!tenantForm.name) return; setTenants((prev) => [{ id: uid(), ...tenantForm }, ...prev]); setTenantForm({ name: "", document: "" }); showToast("Inquilino salvo.", "success"); }}>
              <h2 className="font-semibold">Inquilinos</h2>
              <input className="field" placeholder="Nome" value={tenantForm.name} onChange={(e) => setTenantForm((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="field" placeholder="Documento" value={tenantForm.document} onChange={(e) => setTenantForm((prev) => ({ ...prev, document: e.target.value }))} />
              <button className="btn-primary" type="submit">Salvar</button>
            </form>

            <form className="space-y-2 rounded-lg border border-slate-800 p-4" onSubmit={(e) => { e.preventDefault(); if (!propertyForm.code || !propertyForm.ownerId) return; setProperties((prev) => [{ id: uid(), ...propertyForm }, ...prev]); setPropertyForm({ code: "", address: "", ownerId: "", finishLevel: "medio" }); showToast("Imovel salvo.", "success"); }}>
              <h2 className="font-semibold">Imoveis</h2>
              <input className="field" placeholder="Codigo" value={propertyForm.code} onChange={(e) => setPropertyForm((prev) => ({ ...prev, code: e.target.value }))} />
              <input className="field" placeholder="Endereco" value={propertyForm.address} onChange={(e) => setPropertyForm((prev) => ({ ...prev, address: e.target.value }))} />
              <select className="field" value={propertyForm.finishLevel} onChange={(e) => setPropertyForm((prev) => ({ ...prev, finishLevel: e.target.value as FinishLevel }))}>
                <option value="simples">Simples</option><option value="medio">Medio</option><option value="alto_padrao">Alto padrao</option>
              </select>
              <select className="field" value={propertyForm.ownerId} onChange={(e) => setPropertyForm((prev) => ({ ...prev, ownerId: e.target.value }))}>
                <option value="">Proprietario</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </select>
              <button className="btn-primary" type="submit">Salvar</button>
            </form>

            <form className="space-y-2 rounded-lg border border-slate-800 p-4" onSubmit={(e) => { e.preventDefault(); if (!contractForm.code || !contractForm.propertyId || !contractForm.tenantId) return; setContracts((prev) => [{ id: uid(), ...contractForm }, ...prev]); setContractForm({ code: "", propertyId: "", tenantId: "" }); showToast("Contrato salvo.", "success"); }}>
              <h2 className="font-semibold">Contratos</h2>
              <input className="field" placeholder="Codigo" value={contractForm.code} onChange={(e) => setContractForm((prev) => ({ ...prev, code: e.target.value }))} />
              <select className="field" value={contractForm.propertyId} onChange={(e) => setContractForm((prev) => ({ ...prev, propertyId: e.target.value }))}>
                <option value="">Imovel</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.code}</option>)}
              </select>
              <select className="field" value={contractForm.tenantId} onChange={(e) => setContractForm((prev) => ({ ...prev, tenantId: e.target.value }))}>
                <option value="">Inquilino</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
              <button className="btn-primary" type="submit">Salvar</button>
            </form>
          </section>
        )}

        {activeTab === "vistoria" && (
          <section className="space-y-4">
            {!wizard && <button className="btn-primary" onClick={startNewInspection} type="button">Iniciar vistoria</button>}

            {wizard && (
              <>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((item) => (
                    <button key={item} type="button" className={step === item ? "tab-active" : step > item ? "badge-ok" : "tab"} onClick={() => setStep(item as Step)}>
                      Etapa {item}
                    </button>
                  ))}
                </div>

                {step === 1 && (
                  <div className="grid gap-3 rounded-lg border border-slate-800 p-4 md:grid-cols-2">
                    <select className="field" value={wizard.companyId} disabled>
                      <option value="">Imobiliaria</option>
                      {COMPANIES.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    <select className="field" value={wizard.type} onChange={(e) => syncWizard({ ...wizard, type: e.target.value as InspectionType })}>
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saida</option>
                      <option value="mobiliado">Mobiliado</option>
                    </select>
                    <select className="field" value={wizard.propertyId} onChange={(e) => {
                      const property = properties.find((item) => item.id === e.target.value);
                      syncWizard({ ...wizard, propertyId: e.target.value, address: property?.address || wizard.address, finishLevel: property?.finishLevel || wizard.finishLevel });
                    }}>
                      <option value="">Imovel</option>
                      {properties.map((property) => <option key={property.id} value={property.id}>{property.code} - {property.address}</option>)}
                    </select>
                    <select className="field" value={wizard.contractId} onChange={(e) => syncWizard({ ...wizard, contractId: e.target.value })}>
                      <option value="">Contrato</option>
                      {contracts.filter((item) => item.propertyId === wizard.propertyId).map((contract) => <option key={contract.id} value={contract.id}>{contract.code}</option>)}
                    </select>
                    <input className="field" placeholder="Cliente/locatario" value={wizard.client} onChange={(e) => syncWizard({ ...wizard, client: e.target.value })} />
                    <input className="field md:col-span-2" placeholder="Endereco" value={wizard.address} onChange={(e) => syncWizard({ ...wizard, address: e.target.value })} />
                    <input className="field" placeholder="Tipo de imovel" value={wizard.propertyType} onChange={(e) => syncWizard({ ...wizard, propertyType: e.target.value })} />
                    <input className="field" placeholder="Responsavel pelo acesso" value={wizard.responsible} onChange={(e) => syncWizard({ ...wizard, responsible: e.target.value })} />
                    <button className="btn-primary md:col-span-2" type="button" onClick={() => validateStepOne(wizard) && setStep(2)}>Avancar para ambientes</button>
                  </div>
                )}

                {step === 2 && selectedEnvironment && (
                  <InspectionWizard
                    wizard={wizard}
                    selectedEnvironment={selectedEnvironment}
                    currentEnvironment={currentEnvironment}
                    setCurrentEnvironment={setCurrentEnvironment}
                    syncWizard={syncWizard}
                    assistantText={assistantText}
                    uploadPhotos={uploadPhotos}
                    setCameraOpen={setCameraOpen}
                    onNextStep={() => setStep(3)}
                    validateEnvironmentBeforeAdvance={validateEnvironmentBeforeAdvance}
                    removeEnvironment={removeEnvironment}
                    removePhoto={removePhoto}
                    showToast={showToast}
                  />
                )}

                {step === 3 && (
                  <div className="space-y-4 rounded-lg border border-slate-800 p-4">
                    <h3 className="text-lg font-semibold">Resumo e fechamento</h3>
                    <p className="text-sm text-slate-400">{wizard.id} | {wizard.client} | {wizard.address}</p>
                    {photoWarning && (
                      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-300">
                        {photoWarning}
                      </p>
                    )}

                    <div className="space-y-2">
                      {wizard.environmentOrder.map((envId) => {
                        const env = ENV_CONFIG.find((item) => item.id === envId);
                        if (!env) return null;
                        const data = wizard.environments[env.id];
                        const issues = data.checklist.filter((item) => item.status === "av" || item.status === "in").length;
                        return (
                          <article key={env.id} className="rounded-md border border-slate-800 p-2 text-sm">
                            <p className="font-medium">{env.name}</p>
                            <p className="text-slate-400">
                              {data.checklist.filter((item) => item.status).length}/{data.checklist.length} itens preenchidos | {data.photos.length} fotos | {issues} inconformidades
                            </p>
                          </article>
                        );
                      })}
                    </div>

                    <textarea className="field min-h-20" value={wizard.complements} placeholder="Complementos gerais" onChange={(e) => syncWizard({ ...wizard, complements: e.target.value })} />
                    <textarea className="field min-h-20" value={wizard.legalTerms} placeholder="Termos finais" onChange={(e) => syncWizard({ ...wizard, legalTerms: e.target.value })} />

                    <div className="grid gap-3 md:grid-cols-3">
                      {wizard.signatures.map((signature) => (
                        <article key={signature.role} className="rounded-md border border-slate-800 p-3">
                          <p className="mb-2 text-xs uppercase text-slate-400">{signature.role}</p>
                          <input className="field" placeholder="Nome completo" value={signature.name} onChange={(e) => syncWizard({
                            ...wizard,
                            signatures: wizard.signatures.map((item) => item.role === signature.role ? { ...item, name: e.target.value } : item),
                          })} />
                          <label className="mt-2 flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={signature.accepted} onChange={(e) => syncWizard({
                              ...wizard,
                              signatures: wizard.signatures.map((item) => item.role === signature.role ? { ...item, accepted: e.target.checked } : item),
                            })} />
                            Aceite digital
                          </label>
                        </article>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary" type="button" onClick={() => setStep(2)}>Voltar</button>
                      <button className="btn-secondary" type="button" onClick={() => exportReport(wizard)}>Previsualizar PDF</button>
                      <button className="btn-primary" type="button" onClick={completeInspection}>Concluir vistoria</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <ContinuousCamera
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
          onVideoMode={() => showToast(`Modo video (max ${MAX_VIDEO_SECONDS}s) preparado para proxima versao.`, "info")}
        />

        {activeTab === "comparacao" && (
          <section className="space-y-4 rounded-lg border border-slate-800 p-4">
            <h2 className="text-lg font-semibold">Comparacao entrada x saida</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <select className="field" value={compare.propertyId} onChange={(e) => setCompare({ propertyId: e.target.value, entradaId: "", saidaId: "" })}>
                <option value="">Imovel</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.code} - {property.address}</option>)}
              </select>
              <select className="field" value={compare.entradaId} onChange={(e) => setCompare((prev) => ({ ...prev, entradaId: e.target.value }))}>
                <option value="">Entrada</option>
                {inspections.filter((item) => item.propertyId === compare.propertyId && item.type === "entrada").map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
              </select>
              <select className="field" value={compare.saidaId} onChange={(e) => setCompare((prev) => ({ ...prev, saidaId: e.target.value }))}>
                <option value="">Saida</option>
                {inspections.filter((item) => item.propertyId === compare.propertyId && item.type === "saida").map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {comparison.map((line) => (
                <article key={line.environment} className={line.changed ? "rounded-md border border-amber-500/40 bg-amber-500/10 p-3" : "rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3"}>
                  <p className="font-medium">{line.environment}</p>
                  <p className="text-sm text-slate-300">{line.summary}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "timeline" && (
          <section className="space-y-3 rounded-lg border border-slate-800 p-4">
            {inspections.sort((a, b) => b.createdAt - a.createdAt).map((inspection) => (
              <article key={inspection.id} className="rounded-md border border-slate-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{inspection.id} - {inspection.type} - {inspection.client}</p>
                  <div className="flex gap-2">
                    <span className={inspection.syncedAt ? "badge-ok" : "badge-off"}>{inspection.syncedAt ? "sincronizado" : "pendente"}</span>
                    <button className="btn-secondary" onClick={() => editInspection(inspection)} type="button">Abrir</button>
                    <button className="btn-secondary" onClick={() => exportReport(inspection)} type="button">Laudo PDF</button>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{inspection.address} | {formatDate(inspection.createdAt)}</p>
              </article>
            ))}
            {!inspections.length && <p className="text-slate-400">Nenhuma vistoria registrada.</p>}
          </section>
        )}

        {activeTab === "desempenho" && (
          <section className="grid gap-3 rounded-lg border border-slate-800 p-4 md:grid-cols-2">
            <article><p className="text-sm text-slate-400">Numero medio de fotos por vistoria</p><p className="text-3xl font-bold">{performance.avgPhotos.toFixed(1)}</p></article>
            <article><p className="text-sm text-slate-400">Qualidade media de preenchimento</p><p className="text-3xl font-bold">{performance.quality.toFixed(1)}%</p></article>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;