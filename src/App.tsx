import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Sparkles, HandHeart, Users, Gem, Flower2, Calendar, Clock, MapPin, Wifi,
  Search, X, ChevronRight, ChevronLeft, Check, Volume2, VolumeX, Ruler,
  Contrast, Type, Settings2, Lock, Unlock, LayoutGrid, ClipboardList,
  Stethoscope, Database, Download, Upload, Trash2, Pencil, EyeOff, Eye,
  Plus, MessageCircle, Phone, User, ArrowRight, Loader2, ShieldCheck,
  CalendarCheck, CalendarX, CalendarClock, Menu, Image as ImageIcon, CalendarDays, Cloud
} from "lucide-react";
import { subscribeToCollection, saveDocument, removeDocument } from "./lib/firebase";

/* =========================================================================
   TEMA — Portal CTV (Centro de Terapias Vibracionais)
   Paleta: verde vegetal acolhedor sobre fundo neutro suave.
   ========================================================================= */
const T = {
  bg: "#F7F9F6",
  card: "#FFFFFF",
  primary: "#558B2F",
  primaryLight: "#E7EFDF",
  primarySoft: "#F0F5EB",
  dark: "#2C521B",
  text: "#2C3A28",
  textSoft: "#5B6B57",
  border: "#E1E9DA",
  amber: "#B98900",
  red: "#B3452C",
};

const WHATSAPP_NUMBER = "558499040049";
const ADMIN_PASSWORD = "ctv2024";
const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/* =========================================================================
   TIPOS
   ========================================================================= */
type Modality = "presencial" | "distancia" | "ambas";
type IconKey = "sparkles" | "handheart" | "users" | "gem" | "flower";

interface Therapy {
  id: string;
  name: string;
  icon: IconKey;
  summary: string;
  description: string;
  benefits: string[];
  duration: string;
  contribution: string;
  modality: Modality;
  hidden: boolean;
  isSeed?: boolean;
}

interface Therapist {
  id: string;
  name: string;
  photoUrl?: string;
  specialties: string[]; // therapy ids
  availability: Record<string, string[]>; // dia da semana -> lista de horários (ex.: "Segunda": ["09:00","10:00"])
  unavailableDates?: string[]; // datas específicas (YYYY-MM-DD) em que o terapeuta, excepcionalmente, não atende
  hidden: boolean;
  isSeed?: boolean;
}

type BookingStatus = "pendente" | "confirmado" | "cancelado";

interface Appointment {
  id: string;
  therapyId: string;
  therapistId: string;
  date: string;
  time: string;
  modality: "presencial" | "distancia";
  clientName: string;
  clientPhone: string;
  status: BookingStatus;
  createdAt: string;
  isSeed?: boolean;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  hidden: boolean;
  isSeed?: boolean;
}

const ICONS: Record<IconKey, React.ElementType> = {
  sparkles: Sparkles,
  handheart: HandHeart,
  users: Users,
  gem: Gem,
  flower: Flower2,
};

/* =========================================================================
   DADOS INICIAIS (Base limpa para cadastro de até 50+ terapias e terapeutas)
   ========================================================================= */
const SEED_THERAPIES: Therapy[] = [];
const SEED_THERAPISTS: Therapist[] = [];
const SEED_APPOINTMENTS: Appointment[] = [];

const SEED_FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "Como funciona o agendamento no Portal CTV?",
    answer: "Você escolhe a terapia desejada, o terapeuta de sua preferência, a data e horário disponíveis. Ao finalizar, enviamos os detalhes diretamente para o nosso WhatsApp oficial para confirmação.",
    hidden: false,
  },
  {
    id: "faq-2",
    question: "As sessões a distância funcionam mesmo?",
    answer: "Sim! As terapias vibracionais trabalham no campo sutil e energético, permitindo atendimento com excelente profundidade e acolhimento tanto presencial quanto à distância.",
    hidden: false,
  },
  {
    id: "faq-3",
    question: "Como funciona a contribuição consciente?",
    answer: "É um valor sugerido para apoiar a sustentabilidade do espaço e dos terapeutas, conversado com abertura e acolhimento caso você necessite de flexibilidade.",
    hidden: false,
  },
  {
    id: "faq-4",
    question: "Posso cancelar ou remarcar minha sessão?",
    answer: "Sim. Basta entrar em contato pelo WhatsApp (84) 9904-0049 com antecedência para que possamos reorganizar seu horário.",
    hidden: false,
  },
];

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function weekdayNameFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  const dayIndex = d.getDay(); // 0 = Domingo, 1 = Segunda...
  if (dayIndex === 0) return null; // Domingo
  const map: Record<number, string> = {
    1: "Segunda",
    2: "Terça",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sábado",
  };
  return map[dayIndex] ?? null;
}

/**
 * Corrige registros de terapeuta salvos por uma versão antiga do app (que tinha
 * `bio` e `days` em vez de `photoUrl`/`availability`), evitando tela branca quando
 * o navegador do visitante ainda tem esse formato antigo salvo no localStorage.
 */
function normalizeTherapist(raw: any): Therapist {
  return {
    id: raw?.id ?? genId("pr"),
    name: raw?.name ?? "",
    photoUrl: typeof raw?.photoUrl === "string" ? raw.photoUrl : "",
    specialties: Array.isArray(raw?.specialties) ? raw.specialties : [],
    availability:
      raw?.availability && typeof raw.availability === "object" && !Array.isArray(raw.availability)
        ? raw.availability
        : {},
    unavailableDates: Array.isArray(raw?.unavailableDates) ? raw.unavailableDates : [],
    hidden: !!raw?.hidden,
    isSeed: raw?.isSeed,
  };
}

/** Corrige registros de terapia salvos por versões antigas, garantindo campos mínimos válidos. */
function normalizeTherapy(raw: any): Therapy {
  return {
    id: raw?.id ?? genId("th"),
    name: raw?.name ?? "",
    icon: raw?.icon && ICONS[raw.icon as IconKey] ? raw.icon : "sparkles",
    summary: raw?.summary ?? "",
    description: raw?.description ?? "",
    benefits: Array.isArray(raw?.benefits) ? raw.benefits : [],
    duration: raw?.duration ?? "",
    contribution: raw?.contribution ?? "",
    modality: raw?.modality === "presencial" || raw?.modality === "distancia" ? raw.modality : "ambas",
    hidden: !!raw?.hidden,
    isSeed: raw?.isSeed,
  };
}

/** Corrige registros de agendamento salvos por versões antigas, garantindo campos mínimos válidos. */
function normalizeAppointment(raw: any): Appointment {
  return {
    id: raw?.id ?? genId("ap"),
    therapyId: raw?.therapyId ?? "",
    therapistId: raw?.therapistId ?? "",
    date: raw?.date ?? "",
    time: raw?.time ?? "",
    modality: raw?.modality === "distancia" ? "distancia" : "presencial",
    clientName: raw?.clientName ?? "",
    clientPhone: raw?.clientPhone ?? "",
    status: ["pendente", "confirmado", "cancelado"].includes(raw?.status) ? raw.status : "pendente",
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    isSeed: raw?.isSeed,
  };
}

/** Corrige registros de SAC salvos por versões antigas, garantindo campos mínimos válidos. */
function normalizeFAQ(raw: any): FAQItem {
  return {
    id: raw?.id ?? genId("faq"),
    question: raw?.question ?? "",
    answer: raw?.answer ?? "",
    hidden: !!raw?.hidden,
    isSeed: raw?.isSeed,
  };
}

const LEGACY_SEED_IDS = new Set([
  "th-reiki",
  "th-constelacao",
  "th-cristais",
  "th-florais",
  "pr-ana",
  "pr-carlos",
  "pr-mariana",
  "ap-seed-1",
  "ap-seed-2",
]);

function isLegacySeed(item: any): boolean {
  if (!item) return false;
  return !!item.isSeed || (typeof item.id === "string" && LEGACY_SEED_IDS.has(item.id));
}

/* =========================================================================
   PERSISTÊNCIA — Nuvem (Firebase Firestore) + Cache Local (localStorage)
   ========================================================================= */
function useCloudPersistedState<T extends { id: string }>(collectionName: string, key: string, initial: T[]) {
  const [state, setState] = useState<T[]>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T[];
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((it: any) => !isLegacySeed(it));
          window.localStorage.setItem(key, JSON.stringify(cleaned));
          return cleaned;
        }
      }
      return initial;
    } catch {
      return initial;
    }
  });

  const previousIdsRef = useRef<Set<string>>(new Set(state.map((s) => s.id)));

  // Sincronização em tempo real com o Firebase Firestore
  useEffect(() => {
    const unsub = subscribeToCollection<T>(
      collectionName,
      (cloudItems) => {
        if (cloudItems) {
          const cleaned = cloudItems.filter((it: any) => !isLegacySeed(it));
          setState(cleaned);
          previousIdsRef.current = new Set(cleaned.map((s) => s.id));
          try {
            window.localStorage.setItem(key, JSON.stringify(cleaned));
          } catch {
            // falha silenciosa de cache
          }
        }
      },
      initial
    );

    return () => unsub();
  }, [collectionName, key, initial]);

  const persist = useCallback(
    (value: T[]) => {
      const cleaned = value.filter((it: any) => !isLegacySeed(it));
      setState(cleaned);
      try {
        window.localStorage.setItem(key, JSON.stringify(cleaned));
      } catch {
        // falha silenciosa
      }

      // Sincroniza adições/atualizações na Nuvem Firestore
      const newIds = new Set(cleaned.map((v) => v.id));
      cleaned.forEach((item) => {
        saveDocument(collectionName, item.id, item).catch(() => {});
      });

      // Remove itens deletados da Nuvem Firestore
      previousIdsRef.current.forEach((oldId) => {
        if (!newIds.has(oldId)) {
          removeDocument(collectionName, oldId).catch(() => {});
        }
      });
      previousIdsRef.current = newIds;
    },
    [collectionName, key]
  );

  return [state, persist] as const;
}

function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const persist = useCallback(
    (value: T) => {
      setState(value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // falha silenciosa — dado permanece em memória nesta sessão
      }
    },
    [key]
  );

  return [state, persist] as const;
}

/* =========================================================================
   COMPONENTES UTILITÁRIOS
   ========================================================================= */
function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Ordena por nome em ordem alfabética (pt-BR), usado nas listagens públicas. */
function sortByName<T extends { name: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

/* =========================================================================
   UPLOAD DE FOTO — redimensiona no navegador antes de salvar (localStorage)
   ========================================================================= */
function fileToCompressedDataUrl(file: File, maxSize = 480, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

function ModalityBadge({ modality }: { modality: Modality | "presencial" | "distancia" }) {
  const map: Record<string, { label: string; icon: React.ElementType }> = {
    presencial: { label: "Presencial", icon: MapPin },
    distancia: { label: "A Distância", icon: Wifi },
    ambas: { label: "Presencial · A Distância", icon: Wifi },
  };
  const m = map[modality];
  const IconEl = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: T.primarySoft, color: T.dark }}
    >
      <IconEl className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { label: string; bg: string; fg: string; icon: React.ElementType }> = {
    pendente: { label: "Pendente", bg: "#FCF3D9", fg: "#8A6A00", icon: CalendarClock },
    confirmado: { label: "Confirmado", bg: "#E2F1D8", fg: T.dark, icon: CalendarCheck },
    cancelado: { label: "Cancelado", bg: "#F6E1DA", fg: T.red, icon: CalendarX },
  };
  const m = map[status];
  const IconEl = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: m.bg, color: m.fg }}
    >
      <IconEl className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

/* =========================================================================
   BARRA DE ACESSIBILIDADE
   ========================================================================= */
interface A11yState {
  fontScale: number;
  highContrast: boolean;
  rulerActive: boolean;
}

function AccessibilityToolbar({
  a11y,
  setA11y,
  onReadPage,
  isSpeaking,
  onStopSpeak,
}: {
  a11y: A11yState;
  setA11y: React.Dispatch<React.SetStateAction<A11yState>>;
  onReadPage: () => void;
  isSpeaking: boolean;
  onStopSpeak: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-72 rounded-2xl p-4 shadow-xl border animate-[riseIn_.22s_ease]"
          style={{ background: T.card, borderColor: T.border }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: T.dark }}>
              Acessibilidade
            </p>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 rounded-full hover:bg-black/5">
              <X className="w-4 h-4" style={{ color: T.textSoft }} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2" style={{ color: T.text }}>
                <Type className="w-4 h-4" /> Tamanho do texto
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setA11y((s) => ({ ...s, fontScale: Math.max(0.85, +(s.fontScale - 0.1).toFixed(2)) }))}
                  className="w-7 h-7 rounded-full text-xs font-bold border flex items-center justify-center hover:bg-black/5"
                  style={{ borderColor: T.border, color: T.dark }}
                  aria-label="Diminuir fonte"
                >
                  A-
                </button>
                <button
                  onClick={() => setA11y((s) => ({ ...s, fontScale: 1 }))}
                  className="w-7 h-7 rounded-full text-xs border flex items-center justify-center hover:bg-black/5"
                  style={{ borderColor: T.border, color: T.dark }}
                  aria-label="Fonte padrão"
                >
                  A
                </button>
                <button
                  onClick={() => setA11y((s) => ({ ...s, fontScale: Math.min(1.4, +(s.fontScale + 0.1).toFixed(2)) }))}
                  className="w-7 h-7 rounded-full text-xs font-bold border flex items-center justify-center hover:bg-black/5"
                  style={{ borderColor: T.border, color: T.dark }}
                  aria-label="Aumentar fonte"
                >
                  A+
                </button>
              </div>
            </div>

            <button
              onClick={() => setA11y((s) => ({ ...s, highContrast: !s.highContrast }))}
              className={cx(
                "w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm border transition",
                a11y.highContrast ? "text-white" : "hover:bg-black/5"
              )}
              style={{
                borderColor: T.border,
                background: a11y.highContrast ? T.dark : "transparent",
                color: a11y.highContrast ? "#fff" : T.text,
              }}
            >
              <span className="flex items-center gap-2">
                <Contrast className="w-4 h-4" /> Alto contraste
              </span>
              <span className="text-xs opacity-80">{a11y.highContrast ? "Ativo" : "Inativo"}</span>
            </button>

            <button
              onClick={() => setA11y((s) => ({ ...s, rulerActive: !s.rulerActive }))}
              className={cx(
                "w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm border transition",
                a11y.rulerActive ? "text-white" : "hover:bg-black/5"
              )}
              style={{
                borderColor: T.border,
                background: a11y.rulerActive ? T.primary : "transparent",
                color: a11y.rulerActive ? "#fff" : T.text,
              }}
            >
              <span className="flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Régua de leitura
              </span>
              <span className="text-xs opacity-80">{a11y.rulerActive ? "Ativa" : "Inativa"}</span>
            </button>

            <button
              onClick={isSpeaking ? onStopSpeak : onReadPage}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm border hover:bg-black/5 transition"
              style={{ borderColor: T.border, color: T.text }}
            >
              <span className="flex items-center gap-2">
                {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {isSpeaking ? "Parar leitura" : "Ler página em voz alta"}
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir ferramentas de acessibilidade"
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
        style={{ background: T.primary }}
      >
        <Settings2 className="w-6 h-6" />
      </button>
    </div>
  );
}

/* =========================================================================
   CATÁLOGO DE TERAPIAS
   ========================================================================= */
function TherapyModal({
  therapy,
  onClose,
  onBook,
  speak,
  stopSpeak,
  isSpeaking,
}: {
  therapy: Therapy;
  onClose: () => void;
  onBook: (therapyId: string) => void;
  speak: (text: string) => void;
  stopSpeak: () => void;
  isSpeaking: boolean;
}) {
  const IconEl = ICONS[therapy.icon];
  const fullText = `${therapy.name}. ${therapy.description} Benefícios: ${therapy.benefits.join(", ")}. Duração: ${therapy.duration}. ${therapy.contribution}.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-6 animate-[fadeIn_.18s_ease]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl animate-[riseIn_.25s_ease]"
        style={{ background: T.card }}
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: T.primarySoft }}
            >
              <IconEl className="w-7 h-7" style={{ color: T.primary }} />
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-full hover:bg-black/5">
              <X className="w-5 h-5" style={{ color: T.textSoft }} />
            </button>
          </div>

          <h3 className="text-xl font-semibold mb-1" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
            {therapy.name}
          </h3>
          <div className="mb-4"><ModalityBadge modality={therapy.modality} /></div>

          <p className="text-sm leading-relaxed mb-3" style={{ color: T.text }}>
            {therapy.description}
          </p>

          {therapy.benefits.length > 0 && (
            <p className="text-sm leading-relaxed mb-5" style={{ color: T.text }}>
              <span className="font-semibold" style={{ color: T.dark }}>Benefícios: </span>
              {therapy.benefits.join(", ")}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl p-3" style={{ background: T.primarySoft }}>
              <p className="text-xs" style={{ color: T.textSoft }}>Duração</p>
              <p className="text-sm font-semibold" style={{ color: T.dark }}>{therapy.duration}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: T.primarySoft }}>
              <p className="text-xs" style={{ color: T.textSoft }}>Contribuição</p>
              <p className="text-sm font-semibold" style={{ color: T.dark }}>{therapy.contribution}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => (isSpeaking ? stopSpeak() : speak(fullText))}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border transition hover:bg-black/5"
              style={{ borderColor: T.border, color: T.dark }}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isSpeaking ? "Parar" : "Ouvir"}
            </button>
            <button
              onClick={() => onBook(therapy.id)}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: T.primary }}
            >
              Agendar esta terapia <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TherapyCatalog({
  therapies,
  onBook,
}: {
  therapies: Therapy[];
  onBook: (therapyId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [modFilter, setModFilter] = useState<"todas" | "presencial" | "distancia">("todas");
  const [active, setActive] = useState<Therapy | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.onend = () => setSpeakingId(null);
    setSpeakingId("modal");
    window.speechSynthesis.speak(utter);
  };
  const stopSpeak = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  const filtered = useMemo(() => {
    const result = therapies.filter((t) => {
      if (t.hidden) return false;
      const matchesQuery =
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.summary.toLowerCase().includes(query.toLowerCase());
      const matchesMod =
        modFilter === "todas" ||
        t.modality === "ambas" ||
        t.modality === modFilter;
      return matchesQuery && matchesMod;
    });
    return sortByName(result);
  }, [therapies, query, modFilter]);

  return (
    <section>
      <SectionHeader
        eyebrow="Catálogo"
        title="Terapias oferecidas"
        subtitle="Explore nossas práticas vibracionais e encontre a que ressoa com você."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou tema…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition"
            style={{ borderColor: T.border, background: T.card, color: T.text }}
          />
        </div>
        <div className="flex gap-2">
          {(["todas", "presencial", "distancia"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModFilter(m)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border transition whitespace-nowrap"
              style={{
                borderColor: modFilter === m ? T.primary : T.border,
                background: modFilter === m ? T.primary : T.card,
                color: modFilter === m ? "#fff" : T.text,
              }}
            >
              {m === "todas" ? "Todas" : m === "presencial" ? "Presencial" : "A Distância"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Nenhuma terapia encontrada com esses filtros." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const IconEl = ICONS[t.icon];
            return (
              <button
                key={t.id}
                onClick={() => setActive(t)}
                className="text-left rounded-2xl p-5 border transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2"
                style={{ borderColor: T.border, background: T.card }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: T.primarySoft }}>
                  <IconEl className="w-5 h-5" style={{ color: T.primary }} />
                </div>
                <h3 className="font-semibold mb-1.5" style={{ color: T.dark }}>{t.name}</h3>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: T.textSoft }}>{t.summary}</p>
                <div className="flex items-center justify-between">
                  <ModalityBadge modality={t.modality} />
                  <ChevronRight className="w-4 h-4" style={{ color: T.textSoft }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <TherapyModal
          therapy={active}
          onClose={() => {
            stopSpeak();
            setActive(null);
          }}
          onBook={(id) => {
            stopSpeak();
            setActive(null);
            onBook(id);
          }}
          speak={speak}
          stopSpeak={stopSpeak}
          isSpeaking={speakingId === "modal"}
        />
      )}
    </section>
  );
}

/* =========================================================================
   CORPO CLÍNICO
   ========================================================================= */
function TherapistAvatar({ therapist, size = "w-12 h-12" }: { therapist: Therapist; size?: string }) {
  const initials = therapist.name.split(" ").slice(0, 2).map((n) => n[0]).join("");
  if (therapist.photoUrl) {
    return (
      <img
        src={therapist.photoUrl}
        alt={therapist.name}
        className={cx(size, "rounded-full object-cover shrink-0")}
        style={{ border: `2px solid ${T.primarySoft}` }}
      />
    );
  }
  return (
    <div
      className={cx(size, "rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0")}
      style={{ background: T.primary }}
    >
      {initials}
    </div>
  );
}

function TherapistsSection({
  therapists,
  therapies,
  onBookWith,
}: {
  therapists: Therapist[];
  therapies: Therapy[];
  onBookWith: (therapistId: string) => void;
}) {
  const [dayFilter, setDayFilter] = useState<string>("todos");
  const [query, setQuery] = useState("");

  const visibleTherapists = therapists.filter((p) => !p.hidden);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = visibleTherapists.filter((p) => {
      const matchesDay = dayFilter === "todos" || (p.availability[dayFilter]?.length ?? 0) > 0;
      if (!matchesDay) return false;
      if (!q) return true;
      const matchesName = p.name.toLowerCase().includes(q);
      const matchesSpec = p.specialties.some((id) => {
        const th = therapies.find((t) => t.id === id);
        return th?.name.toLowerCase().includes(q);
      });
      return matchesName || matchesSpec;
    });
    return sortByName(result);
  }, [visibleTherapists, dayFilter, query, therapies]);

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <SectionHeader
          eyebrow="Corpo clínico"
          title="Nossos terapeutas"
          subtitle="Profissionais dedicados a acompanhar sua jornada de cuidado e autoconhecimento."
          noMarginBottom
        />
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full self-start sm:self-auto" style={{ background: T.primarySoft, color: T.dark }}>
          {filtered.length} {filtered.length === 1 ? "terapeuta" : "terapeutas"}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por terapeuta ou especialidade…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition"
            style={{ borderColor: T.border, background: T.card, color: T.text }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setDayFilter("todos")}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition"
            style={{
              borderColor: dayFilter === "todos" ? T.primary : T.border,
              background: dayFilter === "todos" ? T.primary : T.card,
              color: dayFilter === "todos" ? "#fff" : T.text,
            }}
          >
            Todos os dias
          </button>
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition"
              style={{
                borderColor: dayFilter === d ? T.primary : T.border,
                background: dayFilter === d ? T.primary : T.card,
                color: dayFilter === d ? "#fff" : T.text,
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={therapists.length === 0 ? "Nenhum terapeuta cadastrado no momento. Cadastre no Painel Admin." : "Nenhum terapeuta encontrado com esses filtros."} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const specialtyNames = p.specialties
              .map((id) => therapies.find((t) => t.id === id)?.name)
              .filter(Boolean) as string[];
            const activeDays = WEEKDAYS.filter((d) => (p.availability[d]?.length ?? 0) > 0);
            return (
              <div key={p.id} className="rounded-2xl p-5 border" style={{ borderColor: T.border, background: T.card }}>
                <div className="flex items-center gap-3 mb-4">
                  <TherapistAvatar therapist={p} />
                  <div>
                    <h3 className="font-semibold" style={{ color: T.dark }}>{p.name}</h3>
                    <p className="text-xs" style={{ color: T.textSoft }}>
                      {specialtyNames.length > 0 ? specialtyNames.join(" · ") : "Terapias Integrativas"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {activeDays.length === 0 && (
                    <span className="text-xs" style={{ color: T.textSoft }}>Sem horários cadastrados</span>
                  )}
                  {activeDays.map((d) => (
                    <span
                      key={d}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: T.primarySoft, color: T.dark }}
                    >
                      {d} · {p.availability[d].length} horário{p.availability[d].length > 1 ? "s" : ""}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => onBookWith(p.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  style={{ background: T.primary }}
                >
                  Agendar com {p.name.split(" ")[0]} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* =========================================================================
   AGENDAMENTO — WIZARD DE 3 PASSOS
   ========================================================================= */
function BookingWizard({
  therapies,
  therapists,
  appointments,
  presetTherapyId,
  presetTherapistId,
  onComplete,
}: {
  therapies: Therapy[];
  therapists: Therapist[];
  appointments: Appointment[];
  presetTherapyId?: string | null;
  presetTherapistId?: string | null;
  onComplete: (appt: Omit<Appointment, "id" | "status" | "createdAt">) => void;
}) {
  const [step, setStep] = useState(1);
  const [therapyId, setTherapyId] = useState<string | null>(presetTherapyId ?? null);
  const [therapistId, setTherapistId] = useState<string | null>(presetTherapistId ?? null);
  const [therapySearch, setTherapySearch] = useState("");
  const [therapistSearch, setTherapistSearch] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [modality, setModality] = useState<"presencial" | "distancia">("presencial");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [slotTakenWarning, setSlotTakenWarning] = useState(false);

  useEffect(() => {
    if (presetTherapyId) setTherapyId(presetTherapyId);
    if (presetTherapistId) {
      setTherapistId(presetTherapistId);
      setStep(presetTherapyId ? 3 : 2);
    } else if (presetTherapyId) {
      setStep(2);
    }
  }, [presetTherapyId, presetTherapistId]);

  const visibleTherapies = sortByName(therapies.filter((t) => !t.hidden));
  const filteredTherapies = useMemo(() => {
    const q = therapySearch.trim().toLowerCase();
    if (!q) return visibleTherapies;
    return visibleTherapies.filter(
      (t) => t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)
    );
  }, [visibleTherapies, therapySearch]);

  const eligibleTherapists = sortByName(
    therapists.filter((p) => !p.hidden && (!therapyId || p.specialties.includes(therapyId)))
  );
  const filteredTherapists = useMemo(() => {
    const q = therapistSearch.trim().toLowerCase();
    if (!q) return eligibleTherapists;
    return eligibleTherapists.filter((p) => p.name.toLowerCase().includes(q));
  }, [eligibleTherapists, therapistSearch]);

  const selectedTherapy = therapies.find((t) => t.id === therapyId);
  const selectedTherapist = therapists.find((p) => p.id === therapistId);

  const weekday = weekdayNameFromDate(date);
  const takenTimes = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.therapistId === therapistId &&
            a.date === date &&
            (a.status === "pendente" || a.status === "confirmado")
        )
        .map((a) => a.time),
    [appointments, therapistId, date]
  );
  const isBlockedDate = !!(selectedTherapist && date && (selectedTherapist.unavailableDates ?? []).includes(date));
  const availableTimes = useMemo(() => {
    if (!selectedTherapist || !weekday) return [];
    if ((selectedTherapist.unavailableDates ?? []).includes(date)) return [];
    const dayTimes = selectedTherapist.availability[weekday] ?? [];
    return dayTimes.filter((t) => !takenTimes.includes(t)).sort();
  }, [selectedTherapist, weekday, takenTimes, date]);

  useEffect(() => {
    setTime("");
  }, [date, therapistId]);

  const canGoStep2 = !!therapyId;
  const canGoStep3 = !!therapistId;
  const canFinish = !!(date && time && clientName.trim() && clientPhone.trim());

  const steps = [
    { n: 1, label: "Terapia" },
    { n: 2, label: "Terapeuta" },
    { n: 3, label: "Data & Modalidade" },
  ];

  const buildMessage = () => {
    const dateFmt = date
      ? new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : "";
    return (
      `Olá! Gostaria de agendar uma sessão no CTV 🌿\n\n` +
      `🌱 Terapia: ${selectedTherapy?.name}\n` +
      `🧘 Terapeuta: ${selectedTherapist?.name}\n` +
      `📅 Data: ${dateFmt} às ${time}\n` +
      `📍 Modalidade: ${modality === "presencial" ? "Presencial" : "A Distância"}\n\n` +
      `Meu nome: ${clientName}\n` +
      `Meu WhatsApp: ${clientPhone}`
    );
  };

  const handleConfirm = () => {
    if (!therapyId || !therapistId) return;
    if (!availableTimes.includes(time)) {
      setSlotTakenWarning(true);
      setTime("");
      return;
    }
    onComplete({
      therapyId,
      therapistId,
      date,
      time,
      modality,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
    });
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: T.primarySoft }}>
          <Check className="w-8 h-8" style={{ color: T.primary }} />
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
          Solicitação enviada!
        </h3>
        <p className="text-sm mb-6" style={{ color: T.textSoft }}>
          Abrimos o WhatsApp do CTV com sua mensagem pronta. Assim que confirmarmos, seu horário passa para
          "Confirmado".
        </p>
        <button
          onClick={() => {
            setSent(false);
            setStep(1);
            setTherapyId(null);
            setTherapistId(null);
            setTherapySearch("");
            setTherapistSearch("");
            setDate("");
            setTime("");
            setClientName("");
            setClientPhone("");
          }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: T.primary }}
        >
          Fazer novo agendamento
        </button>
      </div>
    );
  }

  return (
    <section>
      <SectionHeader
        eyebrow="Agendamento rápido"
        title="Marque sua sessão"
        subtitle="Três passos simples e enviamos o resumo direto para o nosso WhatsApp."
      />

      {/* stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition"
                style={{
                  background: step >= s.n ? T.primary : T.primarySoft,
                  color: step >= s.n ? "#fff" : T.textSoft,
                }}
              >
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <span className="text-sm font-medium hidden sm:inline" style={{ color: step >= s.n ? T.dark : T.textSoft }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: T.border }} />}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-2xl border p-6" style={{ borderColor: T.border, background: T.card }}>
        {step === 1 && (
          <div className="animate-[fadeIn_.2s_ease]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium" style={{ color: T.text }}>Escolha a terapia</p>
              <span className="text-xs" style={{ color: T.textSoft }}>{visibleTherapies.length} disponíveis</span>
            </div>

            {visibleTherapies.length === 0 ? (
              <EmptyState text="Nenhuma terapia cadastrada ainda. Acesse o Painel Admin para cadastrar suas terapias." />
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
                  <input
                    value={therapySearch}
                    onChange={(e) => setTherapySearch(e.target.value)}
                    placeholder="Filtrar por nome ou tema…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
                    style={{ borderColor: T.border, color: T.text }}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {filteredTherapies.map((t) => {
                    const IconEl = ICONS[t.icon] ?? Sparkles;
                    const selected = therapyId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTherapyId(t.id)}
                        className="text-left rounded-xl p-4 border-2 transition flex items-start gap-3"
                        style={{ borderColor: selected ? T.primary : T.border, background: selected ? T.primarySoft : "transparent" }}
                      >
                        <IconEl className="w-5 h-5 mt-0.5 shrink-0" style={{ color: T.primary }} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: T.dark }}>{t.name}</p>
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: T.textSoft }}>{t.summary || t.duration}</p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredTherapies.length === 0 && (
                    <div className="sm:col-span-2 py-6 text-center text-xs" style={{ color: T.textSoft }}>
                      Nenhuma terapia encontrada com esse termo.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-[fadeIn_.2s_ease]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium" style={{ color: T.text }}>Escolha o terapeuta</p>
              <span className="text-xs" style={{ color: T.textSoft }}>{eligibleTherapists.length} disponíveis</span>
            </div>

            {eligibleTherapists.length === 0 ? (
              <EmptyState text={therapists.length === 0 ? "Nenhum terapeuta cadastrado ainda." : "Nenhum terapeuta vinculado a esta terapia no momento."} />
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
                  <input
                    value={therapistSearch}
                    onChange={(e) => setTherapistSearch(e.target.value)}
                    placeholder="Filtrar terapeutas por nome…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
                    style={{ borderColor: T.border, color: T.text }}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {filteredTherapists.map((p) => {
                    const selected = therapistId === p.id;
                    const activeDays = WEEKDAYS.filter((d) => (p.availability[d]?.length ?? 0) > 0);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTherapistId(p.id)}
                        className="text-left rounded-xl p-4 border-2 transition flex items-center gap-3"
                        style={{ borderColor: selected ? T.primary : T.border, background: selected ? T.primarySoft : "transparent" }}
                      >
                        <TherapistAvatar therapist={p} size="w-10 h-10" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: T.dark }}>{p.name}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: T.textSoft }}>
                            {activeDays.length > 0 ? activeDays.join(", ") : "Consulte horários"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredTherapists.length === 0 && (
                    <div className="sm:col-span-2 py-6 text-center text-xs" style={{ color: T.textSoft }}>
                      Nenhum terapeuta encontrado com esse termo.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="animate-[fadeIn_.2s_ease] space-y-5">
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>Data</span>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlotTakenWarning(false);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
                style={{ borderColor: T.border, color: T.text }}
              />
            </label>

            <div>
              <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>Horário</span>
              {!date && (
                <p className="text-sm rounded-xl p-3" style={{ background: T.primarySoft, color: T.textSoft }}>
                  Escolha uma data para ver os horários disponíveis.
                </p>
              )}
              {date && !weekday && (
                <p className="text-sm rounded-xl p-3" style={{ background: T.primarySoft, color: T.textSoft }}>
                  A clínica não atende aos domingos. Escolha outra data.
                </p>
              )}
              {date && weekday && isBlockedDate && (
                <p className="text-sm rounded-xl p-3" style={{ background: T.primarySoft, color: T.textSoft }}>
                  {selectedTherapist?.name.split(" ")[0]} não atende nesta data específica (dia bloqueado). Escolha outra data.
                </p>
              )}
              {date && weekday && !isBlockedDate && availableTimes.length === 0 && (
                <p className="text-sm rounded-xl p-3" style={{ background: T.primarySoft, color: T.textSoft }}>
                  {selectedTherapist?.name.split(" ")[0]} não tem horários livres em {weekday.toLowerCase()}. Tente outra data.
                </p>
              )}
              {date && weekday && availableTimes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTimes.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTime(t);
                        setSlotTakenWarning(false);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-medium transition"
                      style={{
                        borderColor: time === t ? T.primary : T.border,
                        background: time === t ? T.primarySoft : "transparent",
                        color: T.text,
                      }}
                    >
                      <Clock className="w-3.5 h-3.5" style={{ color: T.primary }} />
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {slotTakenWarning && (
                <p className="text-sm mt-2" style={{ color: T.red }}>
                  Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.
                </p>
              )}
            </div>

            <div>
              <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>Modalidade</span>
              <div className="flex gap-2">
                {(["presencial", "distancia"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModality(m)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition"
                    style={{ borderColor: modality === m ? T.primary : T.border, background: modality === m ? T.primarySoft : "transparent", color: T.text }}
                  >
                    {m === "presencial" ? <MapPin className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                    {m === "presencial" ? "Presencial" : "A Distância"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>Seu nome</span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
                  style={{ borderColor: T.border, color: T.text }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>Seu WhatsApp</span>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(35) 9 9999-9999"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
                  style={{ borderColor: T.border, color: T.text }}
                />
              </label>
            </div>

            {selectedTherapy && selectedTherapist && (
              <div className="rounded-xl p-4 space-y-1.5" style={{ background: T.primarySoft }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: T.textSoft }}>Resumo</p>
                <p className="text-sm" style={{ color: T.dark }}><strong>Terapia:</strong> {selectedTherapy.name}</p>
                <p className="text-sm" style={{ color: T.dark }}><strong>Terapeuta:</strong> {selectedTherapist.name}</p>
                {date && time && <p className="text-sm" style={{ color: T.dark }}><strong>Quando:</strong> {new Date(date + "T00:00:00").toLocaleDateString("pt-BR")} às {time}</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-5 border-t" style={{ borderColor: T.border }}>
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition disabled:opacity-0"
            style={{ color: T.textSoft }}
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
              className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition disabled:opacity-40 hover:brightness-110"
              style={{ background: T.primary }}
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!canFinish}
              className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition disabled:opacity-40 hover:brightness-110"
              style={{ background: T.primary }}
            >
              <MessageCircle className="w-4 h-4" /> Confirmar via WhatsApp
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   PAINEL ADMINISTRATIVO
   ========================================================================= */
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);

  return (
    <div className="max-w-sm mx-auto py-16 text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: T.primarySoft }}>
        <Lock className="w-6 h-6" style={{ color: T.primary }} />
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: T.dark }}>Acesso administrativo</h3>
      <p className="text-sm mb-6" style={{ color: T.textSoft }}>Digite a senha para gerenciar o portal.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pwd === ADMIN_PASSWORD) onLogin();
          else setError(true);
        }}
        className="space-y-3"
      >
        <input
          type="password"
          value={pwd}
          onChange={(e) => {
            setPwd(e.target.value);
            setError(false);
          }}
          placeholder="Senha"
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 text-center"
          style={{ borderColor: error ? T.red : T.border, color: T.text }}
        />
        {error && <p className="text-xs" style={{ color: T.red }}>Senha incorreta. Tente novamente.</p>}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: T.primary }}
        >
          <Unlock className="w-4 h-4" /> Entrar
        </button>
      </form>
    </div>
  );
}

type AdminTab = "agendamentos" | "terapias" | "terapeutas" | "sac" | "backup";

function AdminPanel({
  therapies,
  setTherapies,
  therapists,
  setTherapists,
  appointments,
  setAppointments,
  faqs,
  setFaqs,
}: {
  therapies: Therapy[];
  setTherapies: (v: Therapy[]) => void;
  therapists: Therapist[];
  setTherapists: (v: Therapist[]) => void;
  appointments: Appointment[];
  setAppointments: (v: Appointment[]) => void;
  faqs: FAQItem[];
  setFaqs: (v: FAQItem[]) => void;
}) {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<AdminTab>("agendamentos");

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "agendamentos", label: "Agendamentos", icon: ClipboardList },
    { id: "terapias", label: "Terapias", icon: Sparkles },
    { id: "terapeutas", label: "Terapeutas", icon: Stethoscope },
    { id: "sac", label: "SAC", icon: MessageCircle },
    { id: "backup", label: "Backup", icon: Database },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <SectionHeader eyebrow="Admin" title="Painel administrativo" subtitle="Gerencie agendamentos, terapias, terapeutas e backups." noMarginBottom />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
          <ShieldCheck className="w-3.5 h-3.5" /> Sessão autenticada
        </span>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const IconEl = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition"
              style={{
                borderColor: tab === t.id ? T.primary : T.border,
                background: tab === t.id ? T.primary : T.card,
                color: tab === t.id ? "#fff" : T.text,
              }}
            >
              <IconEl className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "agendamentos" && (
        <AdminAppointments
          appointments={appointments}
          setAppointments={setAppointments}
          therapies={therapies}
          therapists={therapists}
        />
      )}
      {tab === "terapias" && (
        <AdminTherapies
          therapies={therapies}
          setTherapies={setTherapies}
          therapists={therapists}
          setTherapists={setTherapists}
        />
      )}
      {tab === "terapeutas" && (
        <AdminTherapists therapists={therapists} setTherapists={setTherapists} therapies={therapies} />
      )}
      {tab === "sac" && <AdminFAQs faqs={faqs} setFaqs={setFaqs} />}
      {tab === "backup" && (
        <AdminBackup
          therapies={therapies}
          setTherapies={setTherapies}
          therapists={therapists}
          setTherapists={setTherapists}
          appointments={appointments}
          setAppointments={setAppointments}
          faqs={faqs}
          setFaqs={setFaqs}
        />
      )}
    </section>
  );
}

function AdminAppointments({
  appointments,
  setAppointments,
  therapies,
  therapists,
}: {
  appointments: Appointment[];
  setAppointments: (v: Appointment[]) => void;
  therapies: Therapy[];
  therapists: Therapist[];
}) {
  const sorted = [...appointments].sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1));

  const setStatus = (id: string, status: BookingStatus) => {
    setAppointments(appointments.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  if (sorted.length === 0) return <EmptyState text="Nenhum agendamento registrado ainda." />;

  return (
    <div className="space-y-3">
      {sorted.map((a) => {
        const therapy = therapies.find((t) => t.id === a.therapyId);
        const therapist = therapists.find((p) => p.id === a.therapistId);
        const waMsg = `Olá ${a.clientName.split(" ")[0]}! Aqui é do CTV, sobre seu agendamento de ${therapy?.name} em ${new Date(a.date + "T00:00:00").toLocaleDateString("pt-BR")} às ${a.time}.`;
        return (
          <div key={a.id} className="rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center gap-4 justify-between" style={{ borderColor: T.border, background: T.card }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <p className="font-semibold" style={{ color: T.dark }}>{a.clientName}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-sm" style={{ color: T.text }}>{therapy?.name} · {therapist?.name}</p>
              <p className="text-xs mt-1" style={{ color: T.textSoft }}>
                {new Date(a.date + "T00:00:00").toLocaleDateString("pt-BR")} às {a.time} · {a.modality === "presencial" ? "Presencial" : "A Distância"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={a.status}
                onChange={(e) => setStatus(a.id, e.target.value as BookingStatus)}
                className="text-sm rounded-lg border px-2.5 py-2 outline-none"
                style={{ borderColor: T.border, color: T.text }}
              >
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <a
                href={`https://wa.me/${a.clientPhone}?text=${encodeURIComponent(waMsg)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white transition hover:brightness-110"
                style={{ background: "#25D366" }}
              >
                <Phone className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminTherapies({
  therapies,
  setTherapies,
  therapists,
  setTherapists,
}: {
  therapies: Therapy[];
  setTherapies: (v: Therapy[]) => void;
  therapists: Therapist[];
  setTherapists: (v: Therapist[]) => void;
}) {
  const [editing, setEditing] = useState<Therapy | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const save = (t: Therapy, linkedTherapistIds: string[]) => {
    if (therapies.find((x) => x.id === t.id)) {
      setTherapies(therapies.map((x) => (x.id === t.id ? t : x)));
    } else {
      setTherapies([...therapies, t]);
    }
    // sincroniza a mão dupla: atualiza as especialidades de cada terapeuta
    setTherapists(
      therapists.map((p) => {
        const shouldHave = linkedTherapistIds.includes(p.id);
        const has = p.specialties.includes(t.id);
        if (shouldHave && !has) return { ...p, specialties: [...p.specialties, t.id] };
        if (!shouldHave && has) return { ...p, specialties: p.specialties.filter((id) => id !== t.id) };
        return p;
      })
    );
    setEditing(null);
    setCreating(false);
  };

  const remove = (id: string) => {
    setTherapies(therapies.filter((t) => t.id !== id));
    setTherapists(therapists.map((p) => ({ ...p, specialties: p.specialties.filter((sid) => sid !== id) })));
  };
  const toggleHidden = (id: string) =>
    setTherapies(therapies.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)));

  const filteredTherapies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return therapies;
    return therapies.filter((t) => t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q));
  }, [therapies, search]);

  if (editing || creating) {
    return (
      <TherapyForm
        initial={editing ?? undefined}
        therapists={therapists}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={save}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: T.primary }}
        >
          <Plus className="w-4 h-4" /> Nova terapia
        </button>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar terapia…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style={{ borderColor: T.border, color: T.text }}
            />
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg border font-medium shrink-0" style={{ borderColor: T.border, color: T.textSoft }}>
            {therapies.length} total
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {filteredTherapies.map((t) => {
          const linkedNames = therapists.filter((p) => p.specialties.includes(t.id)).map((p) => p.name);
          return (
            <div key={t.id} className="rounded-xl p-4 border flex items-center justify-between gap-3" style={{ borderColor: T.border, background: T.card, opacity: t.hidden ? 0.55 : 1 }}>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: T.dark }}>{t.name}</p>
                <p className="text-xs truncate" style={{ color: T.textSoft }}>{t.summary}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: T.primary }}>
                  {linkedNames.length > 0 ? `Terapeutas: ${linkedNames.join(", ")}` : "Nenhum terapeuta vinculado"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <IconButton onClick={() => toggleHidden(t.id)} label={t.hidden ? "Exibir" : "Ocultar"}>
                  {t.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </IconButton>
                <IconButton onClick={() => setEditing(t)} label="Editar">
                  <Pencil className="w-4 h-4" />
                </IconButton>
                <IconButton onClick={() => remove(t.id)} label="Excluir" danger>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
        {filteredTherapies.length === 0 && (
          <EmptyState text={therapies.length === 0 ? "Nenhuma terapia cadastrada." : "Nenhuma terapia encontrada para esta busca."} />
        )}
      </div>
    </div>
  );
}

function TherapyForm({
  initial,
  therapists,
  onCancel,
  onSave,
}: {
  initial?: Therapy;
  therapists: Therapist[];
  onCancel: () => void;
  onSave: (t: Therapy, linkedTherapistIds: string[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState<IconKey>(initial?.icon ?? "sparkles");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [benefits, setBenefits] = useState(initial?.benefits.join(", ") ?? "");
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const [contribution, setContribution] = useState(initial?.contribution ?? "");
  const [modality, setModality] = useState<Modality>(initial?.modality ?? "ambas");
  const [linkedTherapistIds, setLinkedTherapistIds] = useState<string[]>(
    initial ? therapists.filter((p) => p.specialties.includes(initial.id)).map((p) => p.id) : []
  );

  const toggleTherapist = (id: string) =>
    setLinkedTherapistIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          {
            id: initial?.id ?? genId("th"),
            name,
            icon,
            summary,
            description,
            benefits: benefits.split(",").map((b) => b.trim()).filter(Boolean),
            duration,
            contribution,
            modality,
            hidden: initial?.hidden ?? false,
            isSeed: initial?.isSeed,
          },
          linkedTherapistIds
        );
      }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: T.border, background: T.card }}
    >
      <p className="font-semibold" style={{ color: T.dark }}>{initial ? "Editar terapia" : "Nova terapia"}</p>
      <FormField label="Nome"><Input value={name} onChange={setName} required /></FormField>
      <FormField label="Ícone">
        <div className="flex gap-2">
          {(Object.keys(ICONS) as IconKey[]).map((k) => {
            const IconEl = ICONS[k];
            return (
              <button type="button" key={k} onClick={() => setIcon(k)} className="w-10 h-10 rounded-xl border-2 flex items-center justify-center" style={{ borderColor: icon === k ? T.primary : T.border, background: icon === k ? T.primarySoft : "transparent" }}>
                <IconEl className="w-4 h-4" style={{ color: T.primary }} />
              </button>
            );
          })}
        </div>
      </FormField>
      <FormField label="Resumo curto"><Input value={summary} onChange={setSummary} required /></FormField>
      <FormField label="Descrição completa"><Textarea value={description} onChange={setDescription} required /></FormField>
      <FormField label="Benefícios (separados por vírgula)"><Input value={benefits} onChange={setBenefits} /></FormField>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Duração"><Input value={duration} onChange={setDuration} /></FormField>
        <FormField label="Contribuição consciente"><Input value={contribution} onChange={setContribution} /></FormField>
      </div>
      <FormField label="Modalidade">
        <select value={modality} onChange={(e) => setModality(e.target.value as Modality)} className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: T.border, color: T.text }}>
          <option value="ambas">Ambas</option>
          <option value="presencial">Presencial</option>
          <option value="distancia">A Distância</option>
        </select>
      </FormField>
      <FormField label="Terapeutas que aplicam esta terapia">
        {therapists.length === 0 ? (
          <p className="text-xs" style={{ color: T.textSoft }}>Nenhum terapeuta cadastrado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {therapists.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => toggleTherapist(p.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{
                  borderColor: linkedTherapistIds.includes(p.id) ? T.primary : T.border,
                  background: linkedTherapistIds.includes(p.id) ? T.primary : "transparent",
                  color: linkedTherapistIds.includes(p.id) ? "#fff" : T.text,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </FormField>
      <FormActions onCancel={onCancel} />
    </form>
  );
}

function AdminTherapists({
  therapists,
  setTherapists,
  therapies,
}: {
  therapists: Therapist[];
  setTherapists: (v: Therapist[]) => void;
  therapies: Therapy[];
}) {
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const save = (p: Therapist) => {
    if (therapists.find((x) => x.id === p.id)) {
      setTherapists(therapists.map((x) => (x.id === p.id ? p : x)));
    } else {
      setTherapists([...therapists, p]);
    }
    setEditing(null);
    setCreating(false);
  };

  const remove = (id: string) => setTherapists(therapists.filter((p) => p.id !== id));
  const toggleHidden = (id: string) =>
    setTherapists(therapists.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p)));

  const filteredTherapists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return therapists;
    return therapists.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchTherapy = p.specialties.some((sid) => {
        const th = therapies.find((t) => t.id === sid);
        return th && th.name.toLowerCase().includes(q);
      });
      return matchName || matchTherapy;
    });
  }, [therapists, therapies, search]);

  if (editing || creating) {
    return (
      <TherapistForm
        initial={editing ?? undefined}
        therapies={therapies}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={save}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: T.primary }}
        >
          <Plus className="w-4 h-4" /> Novo terapeuta
        </button>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar terapeuta…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style={{ borderColor: T.border, color: T.text }}
            />
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg border font-medium shrink-0" style={{ borderColor: T.border, color: T.textSoft }}>
            {therapists.length} total
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {filteredTherapists.map((p) => {
          const activeDays = WEEKDAYS.filter((d) => (p.availability[d]?.length ?? 0) > 0);
          return (
            <div key={p.id} className="rounded-xl p-4 border flex items-center justify-between gap-3" style={{ borderColor: T.border, background: T.card, opacity: p.hidden ? 0.55 : 1 }}>
              <div className="flex items-center gap-3 min-w-0">
                <TherapistAvatar therapist={p} size="w-10 h-10" />
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: T.dark }}>{p.name}</p>
                  <p className="text-xs truncate" style={{ color: T.textSoft }}>{activeDays.join(", ") || "Sem horários cadastrados"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <IconButton onClick={() => toggleHidden(p.id)} label={p.hidden ? "Exibir" : "Ocultar"}>
                  {p.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </IconButton>
                <IconButton onClick={() => setEditing(p)} label="Editar">
                  <Pencil className="w-4 h-4" />
                </IconButton>
                <IconButton onClick={() => remove(p.id)} label="Excluir" danger>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
        {filteredTherapists.length === 0 && (
          <EmptyState text={therapists.length === 0 ? "Nenhum terapeuta cadastrado." : "Nenhum terapeuta encontrado para esta busca."} />
        )}
      </div>
    </div>
  );
}

function AvailabilityEditor({
  availability,
  onChange,
}: {
  availability: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const [draftTime, setDraftTime] = useState<Record<string, string>>({});

  const addTime = (day: string) => {
    const t = draftTime[day];
    if (!t) return;
    const current = availability[day] ?? [];
    if (current.includes(t)) return;
    onChange({ ...availability, [day]: [...current, t].sort() });
    setDraftTime((d) => ({ ...d, [day]: "" }));
  };

  const removeTime = (day: string, t: string) => {
    onChange({ ...availability, [day]: (availability[day] ?? []).filter((x) => x !== t) });
  };

  return (
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const times = availability[day] ?? [];
        return (
          <div key={day} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.dark }}>
                <CalendarDays className="w-3.5 h-3.5" style={{ color: T.primary }} /> {day}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={draftTime[day] ?? ""}
                  onChange={(e) => setDraftTime((d) => ({ ...d, [day]: e.target.value }))}
                  className="px-2 py-1.5 rounded-lg border text-xs outline-none"
                  style={{ borderColor: T.border, color: T.text }}
                />
                <button
                  type="button"
                  onClick={() => addTime(day)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ background: T.primary }}
                  aria-label={`Adicionar horário em ${day}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {times.length === 0 ? (
              <p className="text-xs" style={{ color: T.textSoft }}>Nenhum horário neste dia.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {times.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{ background: T.primarySoft, color: T.dark }}
                  >
                    {t}
                    <button type="button" onClick={() => removeTime(day, t)} aria-label={`Remover ${t} de ${day}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Permite marcar datas específicas (ex.: uma terça-feira pontual) em que o
 * terapeuta não atenderá, mesmo mantendo sua recorrência semanal normal.
 */
function UnavailableDatesEditor({
  dates = [],
  onChange,
}: {
  dates?: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const safeDates = dates ?? [];

  const addDate = () => {
    if (!draft) return;
    if (safeDates.includes(draft)) {
      setDraft("");
      return;
    }
    onChange([...safeDates, draft].sort());
    setDraft("");
  };

  const removeDate = (d: string) => onChange(safeDates.filter((x) => x !== d));

  const formatted = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });

  return (
    <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: T.border }}>
      <p className="text-xs" style={{ color: T.textSoft }}>
        Use para bloquear um dia pontual (ex.: esta terça específica), sem alterar a rotina semanal normal.
      </p>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={draft}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDraft(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border text-xs outline-none flex-1"
          style={{ borderColor: T.border, color: T.text }}
        />
        <button
          type="button"
          onClick={addDate}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: T.primary }}
          aria-label="Bloquear data"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {safeDates.length === 0 ? (
        <p className="text-xs" style={{ color: T.textSoft }}>Nenhuma data bloqueada.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {safeDates.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full capitalize"
              style={{ background: T.primarySoft, color: T.dark }}
            >
              {formatted(d)}
              <button type="button" onClick={() => removeDate(d)} aria-label={`Remover bloqueio de ${d}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TherapistForm({
  initial,
  therapies,
  onCancel,
  onSave,
}: {
  initial?: Therapist;
  therapies: Therapy[];
  onCancel: () => void;
  onSave: (p: Therapist) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<string[]>(initial?.specialties ?? []);
  const [availability, setAvailability] = useState<Record<string, string[]>>(initial?.availability ?? {});
  const [unavailableDates, setUnavailableDates] = useState<string[]>(initial?.unavailableDates ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (arr: string[], v: string, setter: (v: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const handlePhotoChange = async (file: File) => {
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecione um arquivo de imagem (JPG, PNG etc.).");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoUrl(dataUrl);
    } catch {
      setPhotoError("Não foi possível carregar essa imagem. Tente outro arquivo.");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: initial?.id ?? genId("pr"),
          name,
          photoUrl,
          specialties,
          availability,
          unavailableDates,
          hidden: initial?.hidden ?? false,
          isSeed: initial?.isSeed,
        });
      }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: T.border, background: T.card }}
    >
      <p className="font-semibold" style={{ color: T.dark }}>{initial ? "Editar terapeuta" : "Novo terapeuta"}</p>
      <FormField label="Nome"><Input value={name} onChange={setName} required /></FormField>
      <FormField label="Foto">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="Pré-visualização" className="w-16 h-16 rounded-full object-cover border" style={{ borderColor: T.border }} />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center border" style={{ borderColor: T.border, background: T.primarySoft }}>
              <ImageIcon className="w-6 h-6" style={{ color: T.textSoft }} />
            </div>
          )}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhotoChange(e.target.files[0])}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition hover:bg-black/5"
                style={{ borderColor: T.border, color: T.dark }}
              >
                <Upload className="w-3.5 h-3.5" /> {photoUrl ? "Trocar foto" : "Enviar foto"}
              </button>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl("")}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition hover:bg-black/5"
                  style={{ borderColor: T.border, color: T.red }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </button>
              )}
            </div>
            {photoError && <p className="text-xs mt-1.5" style={{ color: T.red }}>{photoError}</p>}
            <p className="text-xs mt-1.5" style={{ color: T.textSoft }}>Escolha uma foto do seu computador (JPG ou PNG).</p>
          </div>
        </div>
      </FormField>
      <FormField label="Especialidades">
        <div className="flex flex-wrap gap-2">
          {therapies.map((t) => (
            <button type="button" key={t.id} onClick={() => toggle(specialties, t.id, setSpecialties)} className="px-3 py-1.5 rounded-full text-xs font-medium border" style={{ borderColor: specialties.includes(t.id) ? T.primary : T.border, background: specialties.includes(t.id) ? T.primary : "transparent", color: specialties.includes(t.id) ? "#fff" : T.text }}>
              {t.name}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label="Dias e horários disponíveis">
        <AvailabilityEditor availability={availability} onChange={setAvailability} />
      </FormField>
      <FormField label="Exceções: dias específicos indisponíveis">
        <UnavailableDatesEditor dates={unavailableDates} onChange={setUnavailableDates} />
      </FormField>
      <FormActions onCancel={onCancel} />
    </form>
  );
}

function AdminFAQs({ faqs, setFaqs }: { faqs: FAQItem[]; setFaqs: (v: FAQItem[]) => void }) {
  const [editing, setEditing] = useState<FAQItem | null>(null);
  const [creating, setCreating] = useState(false);

  const save = (f: FAQItem) => {
    if (faqs.find((x) => x.id === f.id)) {
      setFaqs(faqs.map((x) => (x.id === f.id ? f : x)));
    } else {
      setFaqs([...faqs, f]);
    }
    setEditing(null);
    setCreating(false);
  };

  const remove = (id: string) => setFaqs(faqs.filter((f) => f.id !== id));
  const toggleHidden = (id: string) =>
    setFaqs(faqs.map((f) => (f.id === id ? { ...f, hidden: !f.hidden } : f)));

  if (editing || creating) {
    return (
      <FAQForm
        initial={editing ?? undefined}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={save}
      />
    );
  }

  return (
    <div>
      <button
        onClick={() => setCreating(true)}
        className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
        style={{ background: T.primary }}
      >
        <Plus className="w-4 h-4" /> Nova pergunta
      </button>
      {faqs.length === 0 ? (
        <EmptyState text="Nenhuma pergunta cadastrada ainda." />
      ) : (
        <div className="space-y-2">
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl p-4 border flex items-center justify-between gap-3" style={{ borderColor: T.border, background: T.card, opacity: f.hidden ? 0.55 : 1 }}>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: T.dark }}>{f.question}</p>
                <p className="text-xs truncate" style={{ color: T.textSoft }}>{f.answer}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <IconButton onClick={() => toggleHidden(f.id)} label={f.hidden ? "Exibir" : "Ocultar"}>
                  {f.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </IconButton>
                <IconButton onClick={() => setEditing(f)} label="Editar">
                  <Pencil className="w-4 h-4" />
                </IconButton>
                <IconButton onClick={() => remove(f.id)} label="Excluir" danger>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FAQForm({ initial, onCancel, onSave }: { initial?: FAQItem; onCancel: () => void; onSave: (f: FAQItem) => void }) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: initial?.id ?? genId("faq"),
          question,
          answer,
          hidden: initial?.hidden ?? false,
          isSeed: initial?.isSeed,
        });
      }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: T.border, background: T.card }}
    >
      <p className="font-semibold" style={{ color: T.dark }}>{initial ? "Editar pergunta" : "Nova pergunta"}</p>
      <FormField label="Pergunta"><Input value={question} onChange={setQuestion} required /></FormField>
      <FormField label="Resposta"><Textarea value={answer} onChange={setAnswer} required /></FormField>
      <FormActions onCancel={onCancel} />
    </form>
  );
}

function AdminBackup({
  therapies,
  setTherapies,
  therapists,
  setTherapists,
  appointments,
  setAppointments,
  faqs,
  setFaqs,
}: {
  therapies: Therapy[];
  setTherapies: (v: Therapy[]) => void;
  therapists: Therapist[];
  setTherapists: (v: Therapist[]) => void;
  appointments: Appointment[];
  setAppointments: (v: Appointment[]) => void;
  faqs: FAQItem[];
  setFaqs: (v: FAQItem[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportJSON = () => {
    const payload = { therapies, therapists, appointments, faqs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Backup exportado com sucesso.");
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.therapies) setTherapies(data.therapies);
        if (data.therapists) setTherapists(data.therapists);
        if (data.appointments) setAppointments(data.appointments);
        if (data.faqs) setFaqs(data.faqs);
        setMessage("Backup importado com sucesso.");
      } catch {
        setMessage("Não foi possível ler esse arquivo. Verifique se é um backup válido do CTV.");
      }
    };
    reader.readAsText(file);
  };

  const clearSeed = () => {
    setTherapies(therapies.filter((t) => !t.isSeed));
    setTherapists(therapists.filter((p) => !p.isSeed));
    setAppointments(appointments.filter((a) => !a.isSeed));
    setFaqs(faqs.filter((f) => !f.isSeed));
    setMessage("Dados de exemplo removidos. Apenas os dados reais permanecem.");
  };

  return (
    <div className="space-y-4 max-w-xl">
      {message && (
        <div className="rounded-xl p-3 text-sm" style={{ background: T.primarySoft, color: T.dark }}>
          {message}
        </div>
      )}
      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold" style={{ color: T.dark }}>Banco de Dados em Nuvem</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Cloud className="w-3.5 h-3.5" /> Firebase Firestore Ativo
          </span>
        </div>
        <p className="text-sm" style={{ color: T.textSoft }}>
          Todas as alterações de terapias, fotos dos terapeutas, horários e agendamentos são sincronizadas em tempo real na nuvem e aparecem instantaneamente em qualquer celular ou computador.
        </p>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <p className="font-semibold mb-1.5" style={{ color: T.dark }}>Exportar dados</p>
        <p className="text-sm mb-4" style={{ color: T.textSoft }}>Baixe um arquivo .json com terapias, terapeutas e agendamentos atuais.</p>
        <button onClick={exportJSON} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110" style={{ background: T.primary }}>
          <Download className="w-4 h-4" /> Exportar JSON
        </button>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <p className="font-semibold mb-1.5" style={{ color: T.dark }}>Importar dados</p>
        <p className="text-sm mb-4" style={{ color: T.textSoft }}>Restaure um backup .json exportado anteriormente. Isso substitui os dados atuais.</p>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition hover:bg-black/5" style={{ borderColor: T.border, color: T.dark }}>
          <Upload className="w-4 h-4" /> Importar JSON
        </button>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <p className="font-semibold mb-1.5" style={{ color: T.dark }}>Limpar dados de exemplo</p>
        <p className="text-sm mb-4" style={{ color: T.textSoft }}>Remove as terapias, terapeutas e agendamentos fictícios, mantendo apenas os dados reais cadastrados por você.</p>
        <button onClick={clearSeed} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110" style={{ background: "#F6E1DA", color: T.red }}>
          <Trash2 className="w-4 h-4" /> Limpar dados de exemplo
        </button>
      </div>
    </div>
  );
}

/* pequenos elementos reutilizados do admin */
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block" style={{ color: T.text }}>{label}</span>
      {children}
    </label>
  );
}
function Input({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <input
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
      style={{ borderColor: T.border, color: T.text }}
    />
  );
}
function Textarea({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <textarea
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 resize-none"
      style={{ borderColor: T.border, color: T.text }}
    />
  );
}
function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition hover:bg-black/5" style={{ borderColor: T.border, color: T.text }}>
        Cancelar
      </button>
      <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110" style={{ background: T.primary }}>
        Salvar
      </button>
    </div>
  );
}
function IconButton({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center border transition hover:bg-black/5"
      style={{ borderColor: T.border, color: danger ? T.red : T.textSoft }}
    >
      {children}
    </button>
  );
}

/* =========================================================================
   PEQUENOS COMPONENTES DE LAYOUT
   ========================================================================= */
function SectionHeader({ eyebrow, title, subtitle, noMarginBottom }: { eyebrow: string; title: string; subtitle: string; noMarginBottom?: boolean }) {
  return (
    <div className={noMarginBottom ? "" : "mb-7"}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: T.primary }}>{eyebrow}</p>
      <h2 className="text-2xl sm:text-3xl font-semibold mb-1.5" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>{title}</h2>
      <p className="text-sm" style={{ color: T.textSoft }}>{subtitle}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-14 rounded-2xl border border-dashed" style={{ borderColor: T.border }}>
      <p className="text-sm" style={{ color: T.textSoft }}>{text}</p>
    </div>
  );
}

/* =========================================================================
   HERO — ondas vibracionais (elemento de assinatura visual)
   ========================================================================= */
function VibrationalHero({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl mb-10 px-6 py-12 sm:px-12 sm:py-16 text-center" style={{ background: `linear-gradient(180deg, ${T.primarySoft}, ${T.bg})` }}>
      <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite]" style={{ border: `1.5px solid ${T.primary}` }} />
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite_1s]" style={{ border: `1.5px solid ${T.primary}` }} />
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite_2s]" style={{ border: `1.5px solid ${T.primary}` }} />
        <div className="w-20 h-20 rounded-full bg-teal-700/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-emerald-800" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: T.primary }}>Centro de Terapias Vibracionais</p>
      <h1 className="text-3xl sm:text-4xl font-semibold mb-3 max-w-xl mx-auto leading-tight" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
        Um espaço para reencontrar seu equilíbrio
      </h1>
      <p className="text-sm sm:text-base max-w-md mx-auto mb-7" style={{ color: T.textSoft }}>
        Terapias vibracionais conduzidas com presença e cuidado, presencial ou a distância.
      </p>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition hover:brightness-110 hover:-translate-y-0.5"
        style={{ background: T.primary }}
      >
        <Calendar className="w-4 h-4" /> Agendar minha sessão
      </button>
    </div>
  );
}

/* =========================================================================
   NAVEGAÇÃO
   ========================================================================= */
type View = "inicio" | "agendar" | "terapias" | "terapeutas" | "sac" | "admin";

/* =========================================================================
   PÁGINA PÚBLICA — SAC (Perguntas frequentes)
   ========================================================================= */
function FAQPage({ faqs }: { faqs: FAQItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = faqs.filter((f) => !f.hidden);

  return (
    <section>
      <SectionHeader
        eyebrow="Atendimento"
        title="Perguntas frequentes"
        subtitle="Tire suas dúvidas sobre nossas terapias, agendamentos e funcionamento."
      />
      {visible.length === 0 ? (
        <EmptyState text="Nenhuma pergunta cadastrada no momento." />
      ) : (
        <div className="space-y-2 max-w-2xl">
          {visible.map((f) => {
            const open = openId === f.id;
            return (
              <div key={f.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border, background: T.card }}>
                <button
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="w-full flex items-center justify-between gap-3 text-left px-5 py-4"
                >
                  <span className="text-sm font-semibold" style={{ color: T.dark }}>{f.question}</span>
                  <ChevronRight
                    className="w-4 h-4 shrink-0 transition"
                    style={{ color: T.textSoft, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: T.textSoft }}>
                    {f.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items: { id: View; label: string; icon: React.ElementType }[] = [
    { id: "agendar", label: "Agendar", icon: Calendar },
    { id: "terapias", label: "Terapias", icon: LayoutGrid },
    { id: "terapeutas", label: "Terapeutas", icon: Stethoscope },
    { id: "sac", label: "SAC", icon: MessageCircle },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: `${T.bg}E6`, borderColor: T.border }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => setView("inicio")} className="flex items-center gap-2.5">
          <Sparkles className="w-7 h-7 text-emerald-700" />
          <span className="font-semibold text-sm sm:text-base" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
            Portal CTV
          </span>
        </button>

        <nav className="hidden sm:flex items-center gap-1">
          {items.map((it) => {
            const IconEl = it.icon;
            const active = view === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setView(it.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: active ? T.primarySoft : "transparent", color: active ? T.dark : T.textSoft }}
              >
                <IconEl className="w-4 h-4" /> {it.label}
              </button>
            );
          })}
          <button
            onClick={() => setView("admin")}
            aria-label="Painel administrativo"
            className="ml-1 w-9 h-9 rounded-lg flex items-center justify-center transition"
            style={{ background: view === "admin" ? T.primarySoft : "transparent", color: T.textSoft }}
          >
            <Lock className="w-4 h-4" />
          </button>
        </nav>

        <button className="sm:hidden p-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Abrir menu">
          <Menu className="w-5 h-5" style={{ color: T.dark }} />
        </button>
      </div>

      {mobileOpen && (
        <div className="sm:hidden px-4 pb-4 flex flex-col gap-1 animate-[fadeIn_.15s_ease]">
          {[...items, { id: "admin" as View, label: "Admin", icon: Lock }].map((it) => {
            const IconEl = it.icon;
            const active = view === it.id;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setView(it.id);
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition"
                style={{ background: active ? T.primarySoft : "transparent", color: active ? T.dark : T.textSoft }}
              >
                <IconEl className="w-4 h-4" /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}

/* =========================================================================
   APP
   ========================================================================= */
export default function App() {
  const [therapiesRaw, setTherapies] = useCloudPersistedState<Therapy>("therapies", "ctv:therapies", SEED_THERAPIES);
  const [therapistsRaw, setTherapists] = useCloudPersistedState<Therapist>("therapists", "ctv:therapists", SEED_THERAPISTS);
  const [appointmentsRaw, setAppointments] = useCloudPersistedState<Appointment>("appointments", "ctv:appointments", SEED_APPOINTMENTS);
  const [faqsRaw, setFaqs] = useCloudPersistedState<FAQItem>("faqs", "ctv:faqs", SEED_FAQS);

  // Corrige dados salvos por uma versão anterior do app, evitando tela branca e limpando dados antigos de teste.
  const therapies = useMemo(
    () => (Array.isArray(therapiesRaw) ? therapiesRaw.filter((t) => !isLegacySeed(t)).map(normalizeTherapy) : []),
    [therapiesRaw]
  );
  const therapists = useMemo(
    () => (Array.isArray(therapistsRaw) ? therapistsRaw.filter((p) => !isLegacySeed(p)).map(normalizeTherapist) : []),
    [therapistsRaw]
  );
  const appointments = useMemo(
    () => (Array.isArray(appointmentsRaw) ? appointmentsRaw.filter((a) => !isLegacySeed(a)).map(normalizeAppointment) : []),
    [appointmentsRaw]
  );
  const faqs = useMemo(
    () => (Array.isArray(faqsRaw) ? faqsRaw.map(normalizeFAQ) : SEED_FAQS),
    [faqsRaw]
  );

  const [view, setView] = useState<View>("inicio");
  const [presetTherapyId, setPresetTherapyId] = useState<string | null>(null);
  const [presetTherapistId, setPresetTherapistId] = useState<string | null>(null);

  const [a11y, setA11y] = useState<A11yState>({ fontScale: 1, highContrast: false, rulerActive: false });
  const [rulerY, setRulerY] = useState(0);
  const [isSpeakingPage, setIsSpeakingPage] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Aplica o redimensionamento de fonte globalmente no HTML para que todas as classes Tailwind (rem) escalem
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * a11y.fontScale}px`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [a11y.fontScale]);

  useEffect(() => {
    if (!a11y.rulerActive) return;
    const handler = (e: MouseEvent) => setRulerY(e.clientY);
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [a11y.rulerActive]);

  const goBook = (opts?: { therapyId?: string; therapistId?: string }) => {
    setPresetTherapyId(opts?.therapyId ?? null);
    setPresetTherapistId(opts?.therapistId ?? null);
    setView("agendar");
  };

  const handleBookingComplete = (appt: Omit<Appointment, "id" | "status" | "createdAt">) => {
    setAppointments([
      ...appointments,
      { ...appt, id: genId("ap"), status: "pendente", createdAt: new Date().toISOString() },
    ]);
  };

  const readPage = () => {
    const text = mainRef.current?.innerText ?? "";
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.slice(0, 3000));
    utter.lang = "pt-BR";
    utter.onend = () => setIsSpeakingPage(false);
    setIsSpeakingPage(true);
    window.speechSynthesis.speak(utter);
  };
  const stopReadPage = () => {
    window.speechSynthesis.cancel();
    setIsSpeakingPage(false);
  };

  const fontScaleStyle: React.CSSProperties = { fontSize: `${16 * a11y.fontScale}px` };

  return (
    <div
      className={cx("min-h-screen transition-colors duration-300")}
      style={{
        background: a11y.highContrast ? "#0E140B" : T.bg,
        color: a11y.highContrast ? "#FFFFFF" : T.text,
        ...fontScaleStyle,
      }}
    >
      <style>{`
        @keyframes ripple {
          0% { transform: scale(0.6); opacity: .55; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); }
        }
        input:focus, textarea:focus, select:focus, button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px ${T.primaryLight};
        }
        ::selection { background: ${T.primaryLight}; }
      `}</style>

      {a11y.rulerActive && (
        <div
          className="fixed left-0 right-0 h-10 pointer-events-none z-40"
          style={{ top: rulerY - 20, background: "rgba(255, 214, 0, 0.18)", borderTop: "1px solid rgba(184,140,0,.4)", borderBottom: "1px solid rgba(184,140,0,.4)" }}
        />
      )}

      <Header view={view} setView={setView} />

      <main ref={mainRef} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {view === "inicio" && (
          <>
            <VibrationalHero onStart={() => goBook()} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { icon: Sparkles, label: "Terapias", desc: "Conheça nossas práticas", action: () => setView("terapias") },
                { icon: Stethoscope, label: "Terapeutas", desc: "Nosso corpo clínico", action: () => setView("terapeutas") },
                { icon: Calendar, label: "Agendar", desc: "Marque em 3 passos", action: () => goBook() },
                { icon: MessageCircle, label: "SAC", desc: "Perguntas frequentes", action: () => setView("sac") },
              ].map((c, i) => (
                <button key={i} onClick={c.action} className="text-left rounded-2xl p-5 border transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: T.border, background: T.card }}>
                  <c.icon className="w-5 h-5 mb-3" style={{ color: T.primary }} />
                  <p className="font-semibold text-sm mb-1" style={{ color: T.dark }}>{c.label}</p>
                  <p className="text-xs" style={{ color: T.textSoft }}>{c.desc}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "agendar" && (
          <BookingWizard
            therapies={therapies}
            therapists={therapists}
            appointments={appointments}
            presetTherapyId={presetTherapyId}
            presetTherapistId={presetTherapistId}
            onComplete={handleBookingComplete}
          />
        )}

        {view === "terapias" && (
          <TherapyCatalog therapies={therapies} onBook={(therapyId) => goBook({ therapyId })} />
        )}

        {view === "terapeutas" && (
          <TherapistsSection therapists={therapists} therapies={therapies} onBookWith={(therapistId) => goBook({ therapistId })} />
        )}

        {view === "sac" && <FAQPage faqs={faqs} />}

        {view === "admin" && (
          <AdminPanel
            therapies={therapies}
            setTherapies={setTherapies}
            therapists={therapists}
            setTherapists={setTherapists}
            appointments={appointments}
            setAppointments={setAppointments}
            faqs={faqs}
            setFaqs={setFaqs}
          />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-xs" style={{ color: T.textSoft }}>Centro de Terapias Vibracionais · cuidado, presença e equilíbrio.</p>
      </footer>

      <AccessibilityToolbar
        a11y={a11y}
        setA11y={setA11y}
        onReadPage={readPage}
        isSpeaking={isSpeakingPage}
        onStopSpeak={stopReadPage}
      />
    </div>
  );
}
