import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Sparkles, HandHeart, Users, Gem, Flower2, Calendar, Clock, MapPin, Wifi,
  Search, X, ChevronRight, ChevronLeft, Check, Volume2, VolumeX, Ruler,
  Contrast, Type, Settings2, Lock, Unlock, LayoutGrid, ClipboardList,
  Database, Download, Upload, Trash2, Pencil, EyeOff, Eye,
  Plus, MessageCircle, Phone, User, ArrowRight, ArrowDown, Loader2, ShieldCheck,
  CalendarCheck, CalendarX, CalendarClock, Menu, Image as ImageIcon, CalendarDays, Cloud, RefreshCw,
  GripVertical, ChevronUp, ChevronDown, Zap, AlertCircle, Info, FileSpreadsheet,
  AlertTriangle, Ban, Globe, History, PhoneCall
} from "lucide-react";
import { subscribeToCollection, saveDocument, removeDocument } from "./lib/firebase";
import { ExcelExportModal } from "./components/ExcelExportModal";
import {
  Modality,
  IconKey,
  Therapy,
  Therapist,
  BookingStatus,
  Appointment,
  FAQItem,
  WEEKDAYS,
  T,
  formatTwoNames,
} from "./types";

/* =========================================================================
   COMPONENTE DE LOGOTIPO (Circular, sem contorno/frame, bg verde suave)
   ========================================================================= */
function Logo({
  size = 40,
  className = "",
  rounded = "rounded-full",
  variant = "soft",
}: {
  size?: number | string;
  className?: string;
  rounded?: string;
  variant?: "soft" | "solid" | "white" | "transparent";
}) {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem("ctv_custom_logo");
    } catch {
      return null;
    }
  });
  const [sourceIndex, setSourceIndex] = useState(0);

  const candidateSources = useMemo(() => {
    if (customLogo) return [customLogo, "/logo.svg", "/logo.png"];
    return ["/logo.svg", "/logo.png"];
  }, [customLogo]);

  useEffect(() => {
    const updateLogo = () => {
      try {
        const saved = localStorage.getItem("ctv_custom_logo");
        setCustomLogo(saved);
        setSourceIndex(0);
      } catch {
        // ignore
      }
    };
    window.addEventListener("ctv-logo-updated", updateLogo);
    window.addEventListener("storage", updateLogo);
    return () => {
      window.removeEventListener("ctv-logo-updated", updateLogo);
      window.removeEventListener("storage", updateLogo);
    };
  }, []);

  const widthStyle = typeof size === "number" ? `${size}px` : size;
  const heightStyle = typeof size === "number" ? `${size}px` : size;
  const currentSrc = sourceIndex < candidateSources.length ? candidateSources[sourceIndex] : null;

  const bgStyle =
    variant === "soft"
      ? { background: T.primarySoft }
      : variant === "solid"
      ? { background: T.primary }
      : variant === "white"
      ? { background: "#FFFFFF" }
      : { background: "transparent" };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${rounded} ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
        ...bgStyle,
      }}
      title="Centro de Terapias Vibracionais"
    >
      {currentSrc ? (
        <img
          key={currentSrc}
          src={currentSrc}
          alt="CTV"
          className="w-full h-full object-contain p-1 select-none"
          onError={() => setSourceIndex((i) => i + 1)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center w-full h-full p-1 select-none">
          <span
            className="font-black text-xs sm:text-sm tracking-wider leading-none"
            style={{ color: variant === "solid" ? "#FFFFFF" : T.dark }}
          >
            CTV
          </span>
          <span
            className="text-[8px] font-semibold tracking-tight uppercase leading-tight opacity-75 mt-0.5"
            style={{ color: variant === "solid" ? "#FFFFFF" : T.primary }}
          >
            Terapia
          </span>
        </div>
      )}
    </div>
  );
}

const WHATSAPP_NUMBER = "558499040049";
const ADMIN_PASSWORD = "ctv2024";

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
    modality: raw?.modality === "presencial" || raw?.modality === "distancia" ? raw.modality : "ambas",
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

/**
 * Calcula a interseção das modalidades suportadas pela terapia e pelo terapeuta.
 * Garante que a opção seja consistente no agendamento.
 */
function getAllowedModalities(
  therapyModality: Modality = "ambas",
  therapistModality: Modality = "ambas"
): ("presencial" | "distancia")[] {
  const therapyOpts: ("presencial" | "distancia")[] =
    therapyModality === "ambas" ? ["presencial", "distancia"] : [therapyModality];
  const therapistOpts: ("presencial" | "distancia")[] =
    therapistModality === "ambas" ? ["presencial", "distancia"] : [therapistModality];

  const common = therapyOpts.filter((m) => therapistOpts.includes(m));
  if (common.length > 0) return common;
  return therapyOpts;
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
  const validStatuses: BookingStatus[] = [
    "pendente",
    "confirmado",
    "cancelado",
    "faltou_1x",
    "faltou_2x",
    "faltou_3x",
  ];
  return {
    id: raw?.id ?? genId("ap"),
    therapyId: raw?.therapyId ?? "",
    therapistId: raw?.therapistId ?? "",
    date: raw?.date ?? "",
    time: raw?.time ?? "",
    modality: raw?.modality === "distancia" ? "distancia" : "presencial",
    clientName: raw?.clientName ?? "",
    clientPhone: raw?.clientPhone ?? "",
    secondaryPhone: typeof raw?.secondaryPhone === "string" ? raw.secondaryPhone : "",
    status: validStatuses.includes(raw?.status) ? raw.status : "pendente",
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
        if (cloudItems && cloudItems.length > 0) {
          const cleaned = cloudItems.filter((it: any) => !isLegacySeed(it));
          setState(cleaned);
          previousIdsRef.current = new Set(cleaned.map((s) => s.id));
          try {
            window.localStorage.setItem(key, JSON.stringify(cleaned));
          } catch {
            // falha silenciosa de cache
          }
        } else {
          // Se a nuvem estiver vazia, mas houver dados locais salvos no navegador,
          // envia-os para a nuvem para que outros dispositivos (como o celular) os recebam!
          try {
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const localItems = (JSON.parse(raw) as T[]).filter((it: any) => !isLegacySeed(it));
              if (localItems.length > 0) {
                localItems.forEach((item) => {
                  saveDocument(collectionName, item.id, item).catch(() => {});
                });
                setState(localItems);
                previousIdsRef.current = new Set(localItems.map((s) => s.id));
                return;
              }
            }
          } catch {}
          setState([]);
        }
      },
      initial
    );

    return () => unsub();
  }, [collectionName, key, initial]);

  const persist = useCallback(
    async (value: T[]) => {
      const cleaned = value.filter((it: any) => !isLegacySeed(it));
      setState(cleaned);
      try {
        window.localStorage.setItem(key, JSON.stringify(cleaned));
      } catch {
        // falha silenciosa
      }

      // Sincroniza adições/atualizações na Nuvem Firestore
      const newIds = new Set(cleaned.map((v) => v.id));
      for (const item of cleaned) {
        try {
          await saveDocument(collectionName, item.id, item);
        } catch (err) {
          console.error(`Erro ao sincronizar ${collectionName}/${item.id} com Firestore:`, err);
        }
      }

      // Remove itens deletados da Nuvem Firestore
      for (const oldId of Array.from(previousIdsRef.current) as string[]) {
        if (!newIds.has(oldId)) {
          try {
            await removeDocument(collectionName, oldId);
          } catch (err) {
            console.error(`Erro ao remover ${collectionName}/${oldId} do Firestore:`, err);
          }
        }
      }
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
   FORMATAÇÃO, VALIDAÇÃO & SANITIZAÇÃO DE TELEFONE (Nacional & Internacional)
   ========================================================================= */
const COUNTRY_DIAL_PRESETS = [
  { code: "+55", label: "Brasil", flag: "🇧🇷", placeholder: "(84) 99999-9999", ddi: "55" },
  { code: "+1", label: "EUA / Canadá", flag: "🇺🇸", placeholder: "(519) 694-7472", ddi: "1" },
  { code: "+351", label: "Portugal", flag: "🇵🇹", placeholder: "912 345 678", ddi: "351" },
  { code: "+34", label: "Espanha", flag: "🇪🇸", placeholder: "612 345 678", ddi: "34" },
  { code: "+44", label: "Reino Unido", flag: "🇬🇧", placeholder: "7911 123456", ddi: "44" },
  { code: "+39", label: "Itália", flag: "🇮🇹", placeholder: "312 345 6789", ddi: "39" },
  { code: "+49", label: "Alemanha", flag: "🇩🇪", placeholder: "151 23456789", ddi: "49" },
  { code: "+54", label: "Argentina", flag: "🇦🇷", placeholder: "9 11 1234-5678", ddi: "54" },
  { code: "+", label: "Outro Internacional", flag: "🌍", placeholder: "+código número", ddi: "" },
];

/** Máscara amigável e tolerante de telefone brasileiro e internacional */
function maskPhone(value: string): string {
  if (!value) return "";
  const raw = String(value).trim();

  // Se o número começa com '+' ou formato internacional explícito
  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d+]/g, "");
    
    // +1 EUA / Canadá: +1 (XXX) XXX-XXXX
    if (digits.startsWith("+1")) {
      const nums = digits.slice(2).replace(/\D/g, "").slice(0, 10);
      if (!nums) return "+1 ";
      if (nums.length <= 3) return `+1 (${nums}`;
      if (nums.length <= 6) return `+1 (${nums.slice(0, 3)}) ${nums.slice(3)}`;
      return `+1 (${nums.slice(0, 3)}) ${nums.slice(3, 6)}-${nums.slice(6)}`;
    }
    
    // +351 Portugal: +351 XXX XXX XXX
    if (digits.startsWith("+351")) {
      const nums = digits.slice(4).replace(/\D/g, "").slice(0, 9);
      if (!nums) return "+351 ";
      if (nums.length <= 3) return `+351 ${nums}`;
      if (nums.length <= 6) return `+351 ${nums.slice(0, 3)} ${nums.slice(3)}`;
      return `+351 ${nums.slice(0, 3)} ${nums.slice(3, 6)} ${nums.slice(6)}`;
    }
    
    // +55 Brasil explícito com +
    if (digits.startsWith("+55")) {
      const nums = digits.slice(3).replace(/\D/g, "").slice(0, 11);
      if (!nums) return "+55 ";
      if (nums.length <= 2) return `+55 (${nums}`;
      if (nums.length <= 6) return `+55 (${nums.slice(0, 2)}) ${nums.slice(2)}`;
      if (nums.length <= 10) return `+55 (${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
      return `+55 (${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
    }

    // Outros países com +
    const nums = digits.slice(1).replace(/\D/g, "");
    if (nums.length === 0) return "+";
    return `+${nums.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
  }

  // Padrão Brasileiro (sem '+')
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/** 
 * Validação inteligente de digitação de telefone para evitar erros
 */
function validatePhoneQuality(phone: string): {
  isValid: boolean;
  message: string;
  type: "success" | "warning" | "info";
} {
  const raw = (phone || "").trim();
  if (!raw) {
    return { isValid: false, message: "Digite o número com DDD", type: "info" };
  }

  // Internacional com '+'
  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8) {
      return { isValid: true, message: "Número internacional válido", type: "success" };
    }
    return { isValid: false, message: "Número internacional incompleto", type: "warning" };
  }

  // Nacional sem '+'
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return { isValid: true, message: "Número com DDD válido", type: "success" };
  }
  if (digits.length === 8 || digits.length === 9) {
    return {
      isValid: false,
      message: "⚠️ Falta digitar o DDD (ex.: 84)",
      type: "warning",
    };
  }
  if (digits.length < 8) {
    return {
      isValid: false,
      message: "Telefone incompleto",
      type: "warning",
    };
  }
  return { isValid: true, message: "Telefone preenchido", type: "success" };
}

/** 
 * Higieniza qualquer entrada de telefone para o padrão internacional numérico exato exigido pelo wa.me
 * Aceita números do Brasil e do exterior (+1 519..., +351..., etc.)
 */
function sanitizePhoneForWhatsApp(phone: string): string {
  const raw = (phone || "").trim();
  if (!raw) return "";
  const isExplicitIntl = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  
  // Se começou explicitamente com '+' internacional, preserva o número exato com DDI
  if (isExplicitIntl) {
    return digits;
  }
  
  // Remove zero à esquerda caso o usuário digite ex.: 084 99999-9999
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  
  // Se já digitou com 55 no início (12 ou 13 dígitos no Brasil)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  
  // Se digitou apenas 8 ou 9 dígitos locais sem DDD, adiciona o DDD padrão de Natal/RN (84) e DDI 55
  if (digits.length === 8 || digits.length === 9) {
    return "5584" + digits;
  }
  
  // Se tem 10 ou 11 dígitos (DDD + número no Brasil), adiciona o DDI do Brasil (55)
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  
  return digits;
}

/** Gera link wa.me 100% à prova de erros de digitação e espaçamento */
function getWhatsAppUrl(phone: string, message?: string): string {
  const cleanPhone = sanitizePhoneForWhatsApp(phone);
  const textParam = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${cleanPhone || WHATSAPP_NUMBER}${textParam}`;
}

/**
 * Componente amigável de Input de Telefone com suporte a Internacional, Prevenção de Erros de Digitação
 * e campo expansível para Telefone Secundário / Contato de Recado
 */
function SmartPhoneInput({
  value,
  onChange,
  secondaryValue,
  onChangeSecondary,
  required = true,
  label = "Seu WhatsApp / Telefone",
}: {
  value: string;
  onChange: (val: string) => void;
  secondaryValue?: string;
  onChangeSecondary?: (val: string) => void;
  required?: boolean;
  label?: string;
}) {
  const [showSecondary, setShowSecondary] = useState<boolean>(() => !!secondaryValue);
  const [selectedCountry, setSelectedCountry] = useState<string>("+55");
  const validation = validatePhoneQuality(value);

  const handleCountryChange = (dialCode: string) => {
    setSelectedCountry(dialCode);
    if (dialCode === "+55") {
      // Remove prefixos internacionais e mantém dígitos locais
      const digits = value.replace(/\D/g, "");
      onChange(maskPhone(digits.slice(0, 11)));
    } else if (dialCode === "+") {
      onChange("+");
    } else {
      const cleanDigits = value.replace(/\D/g, "");
      onChange(maskPhone(`${dialCode} ${cleanDigits}`));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Se o usuário digitou '+', ajusta o seletor
    if (raw.startsWith("+1")) setSelectedCountry("+1");
    else if (raw.startsWith("+351")) setSelectedCountry("+351");
    else if (raw.startsWith("+34")) setSelectedCountry("+34");
    else if (raw.startsWith("+")) setSelectedCountry("+");
    else setSelectedCountry("+55");

    onChange(maskPhone(raw));
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold block" style={{ color: T.text }}>
            {label} {required && <span className="text-rose-600">*</span>}
          </label>
          <div className="flex items-center gap-1 text-[11px]" style={{ color: T.textSoft }}>
            <Globe className="w-3 h-3" />
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="bg-transparent text-[11px] font-semibold outline-none cursor-pointer border-b border-dashed"
              style={{ borderColor: T.border, color: T.dark }}
              title="Mudar país do telefone"
            >
              {COUNTRY_DIAL_PRESETS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.label} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <input
            type="tel"
            value={value}
            onChange={handleInputChange}
            placeholder={
              selectedCountry === "+55"
                ? "(84) 99999-9999"
                : COUNTRY_DIAL_PRESETS.find((p) => p.code === selectedCountry)?.placeholder || "+código número"
            }
            className={`w-full px-3 py-2 rounded-xl border text-xs outline-none transition focus:ring-2 ${
              validation.type === "warning" && value.length > 2
                ? "border-amber-400 bg-amber-50/30"
                : validation.isValid && value.length >= 8
                ? "border-emerald-400 bg-emerald-50/20"
                : ""
            }`}
            style={{
              borderColor: validation.type === "warning" && value.length > 2 ? "#F59E0B" : T.border,
              color: T.dark,
            }}
          />
        </div>

        {/* Feedback visual de digitação */}
        {value.length > 0 && (
          <p
            className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${
              validation.type === "warning"
                ? "text-amber-700 font-semibold"
                : validation.type === "success"
                ? "text-emerald-700"
                : "text-gray-500"
            }`}
          >
            {validation.type === "warning" && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
            {validation.type === "success" && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
            <span>{validation.message}</span>
          </p>
        )}
      </div>

      {/* Opção para telefone secundário / contato de recado */}
      {onChangeSecondary && (
        <div>
          {!showSecondary ? (
            <button
              type="button"
              onClick={() => setShowSecondary(true)}
              className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1 mt-1 transition"
            >
              <Plus className="w-3 h-3" /> Adicionar 2º telefone / contato para recado
            </button>
          ) : (
            <div className="pt-1.5 border-t border-dashed animate-[fadeIn_.15s_ease]" style={{ borderColor: T.border }}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold block" style={{ color: T.textSoft }}>
                  Telefone Secundário / Recado (Opcional)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowSecondary(false);
                    onChangeSecondary("");
                  }}
                  className="text-[10px] text-rose-600 hover:underline"
                >
                  Remover
                </button>
              </div>
              <input
                type="tel"
                value={secondaryValue || ""}
                onChange={(e) => onChangeSecondary(maskPhone(e.target.value))}
                placeholder="Ex.: Telefone do cônjuge, responsável ou fixo"
                className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none focus:ring-2"
                style={{ borderColor: T.border, color: T.dark }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const map: Record<BookingStatus, { label: string; bg: string; fg: string; border?: string; icon: React.ElementType }> = {
    pendente: { label: "Pendente", bg: "#FCF3D9", fg: "#8A6A00", icon: CalendarClock },
    confirmado: { label: "Confirmado", bg: "#E2F1D8", fg: T.dark, icon: CalendarCheck },
    cancelado: { label: "Cancelado", bg: "#F6E1DA", fg: T.red, icon: CalendarX },
    faltou_1x: { label: "Faltou (1ª vez)", bg: "#FEF3C7", fg: "#B45309", border: "#FDE68A", icon: AlertTriangle },
    faltou_2x: { label: "Faltou (2ª vez)", bg: "#FFEDD5", fg: "#C2410C", border: "#FDBA74", icon: AlertCircle },
    faltou_3x: { label: "Faltou (3ª vez+)", bg: "#FEE2E2", fg: "#B91C1C", border: "#FCA5A5", icon: Ban },
  };
  const m = map[status] || map.pendente;
  const IconEl = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border"
      style={{ background: m.bg, color: m.fg, borderColor: m.border || "transparent" }}
    >
      <IconEl className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

/* =========================================================================
   RÉGUA DE LEITURA ACESSÍVEL (Desktop e Mobile / Touch Friendly)
   ========================================================================= */
function ReadingRuler({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [posY, setPosY] = useState(() => (typeof window !== "undefined" ? Math.round(window.innerHeight * 0.38) : 250));
  const [isDragging, setIsDragging] = useState(false);
  const startDragY = useRef(0);
  const startPosY = useRef(0);

  // Inicializa a régua em 38% da altura da tela ao ativar
  useEffect(() => {
    if (!active) return;
    setPosY((cur) => (cur === 0 ? Math.round(window.innerHeight * 0.38) : cur));
  }, [active]);

  // No desktop (com ponteiro fino / mouse), a régua acompanha o cursor
  useEffect(() => {
    if (!active) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !isDragging) {
        setPosY(Math.max(30, Math.min(window.innerHeight - 60, e.clientY)));
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [active, isDragging]);

  // Manipulação de arraste com toque / mouse na alça
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    startDragY.current = clientY;
    startPosY.current = posY;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      let clientY = 0;
      if ("touches" in e && e.touches.length > 0) {
        clientY = e.touches[0].clientY;
      } else if ("clientY" in e) {
        clientY = (e as MouseEvent).clientY;
      }
      if (clientY > 0) {
        const delta = clientY - startDragY.current;
        const newY = Math.max(25, Math.min(window.innerHeight - 65, startPosY.current + delta));
        setPosY(newY);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [isDragging]);

  if (!active) return null;

  const nudge = (delta: number) => {
    setPosY((prev) => Math.max(25, Math.min(window.innerHeight - 65, prev + delta)));
  };

  return (
    <div
      className="fixed left-0 right-0 z-50 pointer-events-none transition-[top] duration-75 select-none"
      style={{ top: Math.max(0, posY - 26) }}
    >
      {/* Faixa destacada de leitura (não bloqueia toques/rolagem da página) */}
      <div
        className="w-full h-14 pointer-events-none"
        style={{
          background: "rgba(253, 224, 71, 0.24)",
          borderTop: "2.5px solid rgba(202, 138, 4, 0.8)",
          borderBottom: "2.5px solid rgba(202, 138, 4, 0.8)",
          boxShadow: "0 0 16px rgba(202, 138, 4, 0.25)",
        }}
      />

      {/* Alça Flutuante Touch / Mobile Friendly para posicionamento fácil */}
      <div
        className="absolute right-3 -top-3.5 pointer-events-auto flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-full shadow-lg border border-amber-600/40 text-xs font-semibold backdrop-blur-sm transition-transform active:scale-95"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          handleDragStart(e.clientY);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (e.touches.length > 0) handleDragStart(e.touches[0].clientY);
        }}
        role="region"
        aria-label="Controles da régua de leitura"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nudge(-36);
          }}
          aria-label="Subir régua"
          className="p-1 rounded-full hover:bg-black/15 active:bg-black/25"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing px-1">
          <GripVertical className="w-3.5 h-3.5 opacity-90" />
          <span className="text-[11px] tracking-tight hidden sm:inline">Régua</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nudge(36);
          }}
          aria-label="Descer régua"
          className="p-1 rounded-full hover:bg-black/15 active:bg-black/25"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Fechar régua"
          className="p-1 ml-0.5 rounded-full hover:bg-black/15 active:bg-black/25"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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
              <Zap className="w-4 h-4 text-amber-300" /> Agendar sessão <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TherapyCatalog({
  therapies,
  therapists,
  appointments,
  onCompleteBooking,
}: {
  therapies: Therapy[];
  therapists: Therapist[];
  appointments: Appointment[];
  onCompleteBooking: (appt: Omit<Appointment, "id" | "status" | "createdAt">) => void;
}) {
  const [query, setQuery] = useState("");
  const [modFilter, setModFilter] = useState<"todas" | "presencial" | "distancia">("todas");
  const [active, setActive] = useState<Therapy | null>(null);
  const [quickBookingTherapy, setQuickBookingTherapy] = useState<Therapy | null>(null);
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
        subtitle="Explore e conheça nossas práticas vibracionais e solicite sua sessão com os terapeutas habilitados."
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
            const qualifiedTherapists = therapists.filter(
              (p) => !p.hidden && p.specialties.includes(t.id)
            );

            return (
              <div
                key={t.id}
                className="rounded-2xl p-5 border flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: T.border, background: T.card }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: T.primarySoft }}>
                      <IconEl className="w-5 h-5" style={{ color: T.primary }} />
                    </div>
                    <button
                      onClick={() => setActive(t)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border hover:bg-black/5 transition flex items-center gap-1"
                      style={{ borderColor: T.border, color: T.textSoft }}
                      title="Ver detalhes da terapia"
                    >
                      <Info className="w-3.5 h-3.5" /> Detalhes
                    </button>
                  </div>
                  <h3 className="font-semibold mb-1.5" style={{ color: T.dark }}>{t.name}</h3>
                  <p className="text-sm mb-3 leading-relaxed" style={{ color: T.textSoft }}>{t.summary}</p>
                  
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <ModalityBadge modality={t.modality} />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.04)", color: T.textSoft }}>
                      {qualifiedTherapists.length} terapeuta{qualifiedTherapists.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t flex gap-2" style={{ borderColor: T.border }}>
                  <button
                    onClick={() => setQuickBookingTherapy(t)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                    style={{ background: T.primary }}
                  >
                    <Zap className="w-4 h-4 text-amber-300" /> Agendar terapia <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
            const found = therapies.find((t) => t.id === id);
            if (found) setQuickBookingTherapy(found);
          }}
          speak={speak}
          stopSpeak={stopSpeak}
          isSpeaking={speakingId === "modal"}
        />
      )}

      {quickBookingTherapy && (
        <QuickTherapyBookingModal
          therapy={quickBookingTherapy}
          therapists={therapists}
          therapies={therapies}
          appointments={appointments}
          onClose={() => setQuickBookingTherapy(null)}
          onComplete={(appt) => {
            onCompleteBooking(appt);
          }}
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

interface QuickSlot {
  date: string; // YYYY-MM-DD
  dateDisplay: string; // ex: "Amanhã, 21 de agosto (Sex)"
  time: string; // ex: "09:00"
  weekday: string;
}

/**
 * Calcula todos os horários livres e disponíveis nos próximos N dias (padrão 30 dias) para um terapeuta
 */
function getUpcomingAvailableSlots(
  therapist: Therapist,
  appointments: Appointment[],
  limitDays = 30
): QuickSlot[] {
  const slots: QuickSlot[] = [];
  const today = new Date();
  
  // Mapeamento de dia da semana do JS (0-6) para nome no app
  const dayNameMap: Record<number, string> = {
    1: "Segunda",
    2: "Terça",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sábado",
  };

  for (let i = 0; i <= limitDays; i++) {
    const current = new Date(today);
    current.setDate(today.getDate() + i);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const jsDay = current.getDay();
    if (jsDay === 0) continue; // Domingo sem atendimento

    const weekday = dayNameMap[jsDay];
    if (!weekday) continue;

    // Verifica se a data está bloqueada especificamente para este terapeuta
    if ((therapist.unavailableDates ?? []).includes(dateStr)) continue;

    const dayAvailability = therapist.availability[weekday] ?? [];
    if (dayAvailability.length === 0) continue;

    // Horários já reservados
    const takenTimes = appointments
      .filter(
        (a) =>
          a.therapistId === therapist.id &&
          a.date === dateStr &&
          (a.status === "pendente" || a.status === "confirmado")
      )
      .map((a) => a.time);

    const freeTimes = dayAvailability.filter((t) => !takenTimes.includes(t)).sort();

    let relativePrefix = "";
    if (i === 0) relativePrefix = "Hoje, ";
    else if (i === 1) relativePrefix = "Amanhã, ";

    const monthNames = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const dateDisplay = `${relativePrefix}${current.getDate()} de ${monthNames[current.getMonth()]} (${weekday})`;

    for (const time of freeTimes) {
      slots.push({
        date: dateStr,
        dateDisplay,
        time,
        weekday,
      });
    }
  }

  return slots;
}

/* =========================================================================
   MODAL DE AGENDAMENTO RÁPIDO SOS (Próximos 30 dias com o terapeuta escolhido)
   ========================================================================= */
function QuickTherapistBookingModal({
  therapist,
  therapies,
  appointments,
  onClose,
  onComplete,
}: {
  therapist: Therapist;
  therapies: Therapy[];
  appointments: Appointment[];
  onClose: () => void;
  onComplete: (appt: Omit<Appointment, "id" | "status" | "createdAt">) => void;
}) {
  // Filtra apenas as terapias estritamente atendidas por esse terapeuta
  const availableTherapies = useMemo(() => {
    return therapies.filter((t) => !t.hidden && therapist.specialties.includes(t.id));
  }, [therapies, therapist]);

  // Se tiver só 1 especialidade, já pré-seleciona ela
  const [selectedTherapyId, setSelectedTherapyId] = useState<string>(() => {
    if (availableTherapies.length === 1) return availableTherapies[0].id;
    return availableTherapies[0]?.id || "";
  });

  const [selectedSlot, setSelectedSlot] = useState<QuickSlot | null>(null);
  const [modality, setModality] = useState<"presencial" | "distancia">("presencial");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [sent, setSent] = useState(false);

  // Calcula os horários dos próximos 30 dias
  const availableSlots = useMemo(() => {
    return getUpcomingAvailableSlots(therapist, appointments, 30);
  }, [therapist, appointments]);

  // Agrupa os horários por data
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { dateDisplay: string; times: string[]; date: string; weekday: string }>();
    for (const s of availableSlots) {
      if (!map.has(s.date)) {
        map.set(s.date, { dateDisplay: s.dateDisplay, times: [], date: s.date, weekday: s.weekday });
      }
      map.get(s.date)!.times.push(s.time);
    }
    return Array.from(map.values());
  }, [availableSlots]);

  const selectedTherapy = therapies.find((t) => t.id === selectedTherapyId);

  const allowedModalities = useMemo(() => {
    return getAllowedModalities(selectedTherapy?.modality, therapist.modality);
  }, [selectedTherapy?.modality, therapist.modality]);

  useEffect(() => {
    if (!allowedModalities.includes(modality)) {
      setModality(allowedModalities[0] || "presencial");
    }
  }, [allowedModalities, modality]);

  const canSubmit = !!(
    selectedTherapyId &&
    selectedSlot &&
    clientName.trim() &&
    clientPhone.trim()
  );

  const buildMessage = () => {
    const phoneFormatted = maskPhone(clientPhone) || clientPhone.trim();
    const secFormatted = secondaryPhone.trim() ? maskPhone(secondaryPhone) : "";
    return (
      `Olá! Gostaria de solicitar um agendamento rápido no CTV\n\n` +
      `Terapeuta: ${therapist.name}\n` +
      `Terapia: ${selectedTherapy?.name || "Terapia Integrativa"}\n` +
      `Data: ${selectedSlot?.dateDisplay.replace(/^[A-Za-z]+,\s*/, "")} às ${selectedSlot?.time}\n` +
      `Modalidade: ${modality === "presencial" ? "Presencial" : "A Distância"}\n\n` +
      `Meu nome: ${clientName.trim()}\n` +
      `Meu WhatsApp: ${phoneFormatted}\n` +
      (secFormatted ? `Telefone secundário / recado: ${secFormatted}\n` : "") +
      `\nAguardo seu contato!`
    );
  };

  const handleConfirm = () => {
    if (!selectedSlot || !selectedTherapyId) return;

    const formattedName = formatTwoNames(clientName.trim());

    onComplete({
      therapyId: selectedTherapyId,
      therapistId: therapist.id,
      date: selectedSlot.date,
      time: selectedSlot.time,
      modality,
      clientName: formattedName,
      clientPhone: maskPhone(clientPhone) || clientPhone.trim(),
      secondaryPhone: secondaryPhone.trim() ? maskPhone(secondaryPhone) : "",
    });

    const url = getWhatsAppUrl(WHATSAPP_NUMBER, buildMessage());
    window.open(url, "_blank");
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(35, 48, 38, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto border shadow-2xl p-5 sm:p-7 transition-all animate-[riseIn_.2s_ease]"
        style={{ borderColor: T.border, background: T.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <TherapistAvatar therapist={therapist} size="w-12 h-12" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
                  <Zap className="w-3 h-3 inline mr-1 text-amber-600" /> Agendamento (30 dias)
                </span>
              </div>
              <h2 className="text-lg font-bold" style={{ color: T.dark }}>
                Agendar com {therapist.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" style={{ color: T.textSoft }} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: T.primarySoft }}>
              <Check className="w-8 h-8" style={{ color: T.primary }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
              Solicitação enviada com sucesso!
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: T.textSoft }}>
              Abrimos o WhatsApp do CTV com todos os dados da sessão com <strong>{therapist.name}</strong> para confirmação imediata.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: T.primary }}
            >
              Concluir e voltar
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Escolha de terapia (apenas as que o terapeuta atende) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: T.textSoft }}>
                1. Terapia ({availableTherapies.length})
              </label>
              {availableTherapies.length === 0 ? (
                <div className="p-3.5 rounded-xl border text-xs flex items-center gap-2" style={{ borderColor: T.border, background: T.primarySoft, color: T.text }}>
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Este terapeuta ainda não possui terapias específicas vinculadas no painel. O agendamento será registrado como Atendimento Integrativo.</span>
                </div>
              ) : availableTherapies.length === 1 ? (
                <div className="p-3.5 rounded-xl border flex items-center gap-3" style={{ borderColor: T.primary, background: T.primarySoft }}>
                  <Sparkles className="w-5 h-5" style={{ color: T.primary }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: T.dark }}>{availableTherapies[0].name}</p>
                    <p className="text-xs" style={{ color: T.textSoft }}>{availableTherapies[0].duration} · {availableTherapies[0].contribution}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableTherapies.map((t) => {
                    const isSel = selectedTherapyId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTherapyId(t.id)}
                        className="text-left p-3 rounded-xl border-2 transition flex items-center gap-2.5"
                        style={{
                          borderColor: isSel ? T.primary : T.border,
                          background: isSel ? T.primarySoft : "transparent",
                        }}
                      >
                        <Sparkles className="w-4 h-4 shrink-0" style={{ color: isSel ? T.primary : T.textSoft }} />
                        <span className="text-xs font-semibold truncate" style={{ color: T.dark }}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Escolha de data e horário livre nos próximos 30 dias */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: T.textSoft }}>
                  2. Próximos horários disponíveis (30 dias)
                </label>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
                  {availableSlots.length} vaga{availableSlots.length !== 1 ? "s" : ""}
                </span>
              </div>

              {groupedSlots.length === 0 ? (
                <div className="p-4 rounded-xl border text-center text-xs space-y-1.5" style={{ borderColor: T.border, background: T.primarySoft, color: T.textSoft }}>
                  <p className="font-medium" style={{ color: T.dark }}>Nenhum horário livre encontrado nos próximos 30 dias.</p>
                  <p>Consulte diretamente pelo WhatsApp oficial do CTV para encaixes.</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto pr-1 space-y-2.5 rounded-xl border p-2.5" style={{ borderColor: T.border, background: "rgba(0,0,0,0.015)" }}>
                  {groupedSlots.map((group) => (
                    <div key={group.date} className="space-y-1.5">
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: T.dark }}>
                        <CalendarDays className="w-3.5 h-3.5" style={{ color: T.primary }} />
                        {group.dateDisplay}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.times.map((time) => {
                          const isSel = selectedSlot?.date === group.date && selectedSlot?.time === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() =>
                                setSelectedSlot({
                                  date: group.date,
                                  dateDisplay: group.dateDisplay,
                                  time,
                                  weekday: group.weekday,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition flex items-center gap-1"
                              style={{
                                borderColor: isSel ? T.primary : T.border,
                                background: isSel ? T.primary : T.card,
                                color: isSel ? "#ffffff" : T.text,
                              }}
                            >
                              <Clock className="w-3 h-3" style={{ color: isSel ? "#ffffff" : T.primary }} />
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Modalidade */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: T.textSoft }}>
                3. Modalidade
              </label>
              {allowedModalities.length === 1 ? (
                <div
                  className="p-3 rounded-xl border flex items-center gap-3"
                  style={{ borderColor: T.border, background: T.primarySoft }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white" style={{ color: T.primary }}>
                    {allowedModalities[0] === "presencial" ? <MapPin className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: T.dark }}>
                      Atendimento {allowedModalities[0] === "presencial" ? "Presencial" : "A Distância"}
                    </p>
                    <p className="text-[11px]" style={{ color: T.textSoft }}>
                      {selectedTherapy?.modality !== "ambas"
                        ? "Modalidade exclusiva desta técnica terapêutica."
                        : "Modalidade de atendimento deste terapeuta voluntário."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {(["presencial", "distancia"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModality(m)}
                      className="flex-1 py-2 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      style={{
                        borderColor: modality === m ? T.primary : T.border,
                        background: modality === m ? T.primarySoft : "transparent",
                        color: T.dark,
                      }}
                    >
                      {m === "presencial" ? <MapPin className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                      {m === "presencial" ? "Presencial" : "A Distância"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Dados do paciente */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: T.text }}>
                  Seu nome (dois nomes) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-2"
                  style={{ borderColor: T.border, color: T.dark }}
                />
              </div>

              <SmartPhoneInput
                value={clientPhone}
                onChange={setClientPhone}
                secondaryValue={secondaryPhone}
                onChangeSecondary={setSecondaryPhone}
                label="Seu WhatsApp / Telefone"
                required
              />
            </div>

            {/* Resumo do agendamento */}
            {selectedSlot && (
              <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: T.primarySoft, color: T.dark }}>
                <p><strong>Terapeuta:</strong> {therapist.name}</p>
                <p><strong>Quando:</strong> {selectedSlot.dateDisplay} às {selectedSlot.time}</p>
              </div>
            )}

            {/* Botão de confirmação */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition disabled:opacity-40 hover:brightness-110 shadow-sm"
              style={{ background: T.primary }}
            >
              <MessageCircle className="w-4 h-4" /> Confirmar via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL DE AGENDAMENTO RÁPIDO POR TERAPIA (Próximos 30 dias com terapeutas da terapia)
   ========================================================================= */
function QuickTherapyBookingModal({
  therapy,
  therapists,
  therapies,
  appointments,
  onClose,
  onComplete,
}: {
  therapy: Therapy;
  therapists: Therapist[];
  therapies: Therapy[];
  appointments: Appointment[];
  onClose: () => void;
  onComplete: (appt: Omit<Appointment, "id" | "status" | "createdAt">) => void;
}) {
  // Filtra estritamente os terapeutas que atendem a terapia selecionada
  const qualifiedTherapists = useMemo(() => {
    return therapists.filter((p) => !p.hidden && p.specialties.includes(therapy.id));
  }, [therapists, therapy]);

  // Pré-seleciona o primeiro terapeuta disponível se houver
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(() => {
    if (qualifiedTherapists.length === 1) return qualifiedTherapists[0].id;
    return qualifiedTherapists[0]?.id || "";
  });

  const [selectedSlot, setSelectedSlot] = useState<QuickSlot | null>(null);
  const [modality, setModality] = useState<"presencial" | "distancia">(() => {
    if (therapy.modality === "distancia") return "distancia";
    return "presencial";
  });
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [sent, setSent] = useState(false);

  const selectedTherapist = therapists.find((p) => p.id === selectedTherapistId);

  const allowedModalities = useMemo(() => {
    return getAllowedModalities(therapy.modality, selectedTherapist?.modality);
  }, [therapy.modality, selectedTherapist?.modality]);

  useEffect(() => {
    if (!allowedModalities.includes(modality)) {
      setModality(allowedModalities[0] || "presencial");
    }
  }, [allowedModalities, modality]);

  // Calcula os horários dos próximos 30 dias para o terapeuta selecionado
  const availableSlots = useMemo(() => {
    if (!selectedTherapist) return [];
    return getUpcomingAvailableSlots(selectedTherapist, appointments, 30);
  }, [selectedTherapist, appointments]);

  // Agrupa os horários por data
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { dateDisplay: string; times: string[]; date: string; weekday: string }>();
    for (const s of availableSlots) {
      if (!map.has(s.date)) {
        map.set(s.date, { dateDisplay: s.dateDisplay, times: [], date: s.date, weekday: s.weekday });
      }
      map.get(s.date)!.times.push(s.time);
    }
    return Array.from(map.values());
  }, [availableSlots]);

  const canSubmit = !!(
    selectedTherapistId &&
    selectedSlot &&
    clientName.trim() &&
    clientPhone.trim()
  );

  const buildMessage = () => {
    const phoneFormatted = maskPhone(clientPhone) || clientPhone.trim();
    const secFormatted = secondaryPhone.trim() ? maskPhone(secondaryPhone) : "";
    return (
      `Olá! Gostaria de solicitar um agendamento no CTV\n\n` +
      `Terapia: ${therapy.name}\n` +
      `Terapeuta: ${selectedTherapist?.name || ""}\n` +
      `Data: ${selectedSlot?.dateDisplay.replace(/^[A-Za-z]+,\s*/, "")} às ${selectedSlot?.time}\n` +
      `Modalidade: ${modality === "presencial" ? "Presencial" : "A Distância"}\n\n` +
      `Meu nome: ${clientName.trim()}\n` +
      `Meu WhatsApp: ${phoneFormatted}\n` +
      (secFormatted ? `Telefone secundário / recado: ${secFormatted}\n` : "") +
      `\nAguardo seu contato!`
    );
  };

  const handleConfirm = () => {
    if (!selectedSlot || !selectedTherapistId) return;

    const formattedName = formatTwoNames(clientName.trim());

    onComplete({
      therapyId: therapy.id,
      therapistId: selectedTherapistId,
      date: selectedSlot.date,
      time: selectedSlot.time,
      modality,
      clientName: formattedName,
      clientPhone: maskPhone(clientPhone) || clientPhone.trim(),
      secondaryPhone: secondaryPhone.trim() ? maskPhone(secondaryPhone) : "",
    });

    const url = getWhatsAppUrl(WHATSAPP_NUMBER, buildMessage());
    window.open(url, "_blank");
    setSent(true);
  };

  const IconEl = ICONS[therapy.icon];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(35, 48, 38, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto border shadow-2xl p-5 sm:p-7 transition-all animate-[riseIn_.2s_ease]"
        style={{ borderColor: T.border, background: T.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: T.primarySoft }}>
              <IconEl className="w-6 h-6" style={{ color: T.primary }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
                  <Zap className="w-3 h-3 inline mr-1 text-amber-600" /> Agendamento por Terapia (30 dias)
                </span>
              </div>
              <h2 className="text-lg font-bold" style={{ color: T.dark }}>
                {therapy.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" style={{ color: T.textSoft }} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: T.primarySoft }}>
              <Check className="w-8 h-8" style={{ color: T.primary }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
              Solicitação enviada com sucesso!
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: T.textSoft }}>
              Abrimos o WhatsApp do CTV com todos os dados da sua sessão de <strong>{therapy.name}</strong> para confirmação imediata.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: T.primary }}
            >
              Concluir e voltar
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Escolha de terapeuta (apenas os que realizam esta terapia) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: T.textSoft }}>
                1. Escolha o Terapeuta ({qualifiedTherapists.length})
              </label>
              {qualifiedTherapists.length === 0 ? (
                <div className="p-3.5 rounded-xl border text-xs flex items-center gap-2" style={{ borderColor: T.border, background: T.primarySoft, color: T.text }}>
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Ainda não há terapeutas vinculados a esta terapia no painel. Consulte a recepção pelo WhatsApp.</span>
                </div>
              ) : qualifiedTherapists.length === 1 ? (
                <div className="p-3.5 rounded-xl border flex items-center gap-3" style={{ borderColor: T.primary, background: T.primarySoft }}>
                  <TherapistAvatar therapist={qualifiedTherapists[0]} size="w-10 h-10" />
                  <div>
                    <p className="text-sm font-bold" style={{ color: T.dark }}>{qualifiedTherapists[0].name}</p>
                    <p className="text-xs" style={{ color: T.textSoft }}>Terapeuta voluntário habilitado</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {qualifiedTherapists.map((p) => {
                    const isSel = selectedTherapistId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedTherapistId(p.id);
                          setSelectedSlot(null);
                        }}
                        className="text-left p-3 rounded-xl border-2 transition flex items-center gap-2.5"
                        style={{
                          borderColor: isSel ? T.primary : T.border,
                          background: isSel ? T.primarySoft : "transparent",
                        }}
                      >
                        <TherapistAvatar therapist={p} size="w-8 h-8" />
                        <span className="text-xs font-semibold truncate" style={{ color: T.dark }}>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Escolha de data e horário livre nos próximos 30 dias */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: T.textSoft }}>
                  2. Próximos horários disponíveis (30 dias)
                </label>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
                  {availableSlots.length} vaga{availableSlots.length !== 1 ? "s" : ""}
                </span>
              </div>

              {groupedSlots.length === 0 ? (
                <div className="p-4 rounded-xl border text-center text-xs space-y-1.5" style={{ borderColor: T.border, background: T.primarySoft, color: T.textSoft }}>
                  <p className="font-medium" style={{ color: T.dark }}>Nenhum horário livre encontrado para este terapeuta nos próximos 30 dias.</p>
                  <p>Experimente selecionar outro terapeuta ou entre em contato pelo WhatsApp.</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto pr-1 space-y-2.5 rounded-xl border p-2.5" style={{ borderColor: T.border, background: "rgba(0,0,0,0.015)" }}>
                  {groupedSlots.map((group) => (
                    <div key={group.date} className="space-y-1.5">
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: T.dark }}>
                        <CalendarDays className="w-3.5 h-3.5" style={{ color: T.primary }} />
                        {group.dateDisplay}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.times.map((time) => {
                          const isSel = selectedSlot?.date === group.date && selectedSlot?.time === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() =>
                                setSelectedSlot({
                                  date: group.date,
                                  dateDisplay: group.dateDisplay,
                                  time,
                                  weekday: group.weekday,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition flex items-center gap-1"
                              style={{
                                borderColor: isSel ? T.primary : T.border,
                                background: isSel ? T.primary : T.card,
                                color: isSel ? "#ffffff" : T.text,
                              }}
                            >
                              <Clock className="w-3 h-3" style={{ color: isSel ? "#ffffff" : T.primary }} />
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Modalidade */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: T.textSoft }}>
                3. Modalidade
              </label>
              {allowedModalities.length === 1 ? (
                <div
                  className="p-3.5 rounded-xl border flex items-center gap-3"
                  style={{ borderColor: T.border, background: T.primarySoft }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white shadow-xs" style={{ color: T.primary }}>
                    {allowedModalities[0] === "presencial" ? <MapPin className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: T.dark }}>
                      Atendimento {allowedModalities[0] === "presencial" ? "Presencial" : "A Distância"}
                    </p>
                    <p className="text-[11px]" style={{ color: T.textSoft }}>
                      {therapy.modality !== "ambas"
                        ? "Modalidade exclusiva desta técnica terapêutica."
                        : selectedTherapist?.modality !== "ambas"
                        ? `Modalidade de atendimento de ${selectedTherapist?.name?.split(" ")[0] || "terapeuta"}.`
                        : "Modalidade definida para a sessão."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {(["presencial", "distancia"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModality(m)}
                      className="flex-1 py-2 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      style={{
                        borderColor: modality === m ? T.primary : T.border,
                        background: modality === m ? T.primarySoft : "transparent",
                        color: T.dark,
                      }}
                    >
                      {m === "presencial" ? <MapPin className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                      {m === "presencial" ? "Presencial" : "A Distância"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Dados do paciente */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: T.text }}>
                  Seu nome (dois nomes) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-2"
                  style={{ borderColor: T.border, color: T.dark }}
                />
              </div>

              <SmartPhoneInput
                value={clientPhone}
                onChange={setClientPhone}
                secondaryValue={secondaryPhone}
                onChangeSecondary={setSecondaryPhone}
                label="Seu WhatsApp / Telefone"
                required
              />
            </div>

            {/* Resumo do agendamento */}
            {selectedSlot && selectedTherapist && (
              <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: T.primarySoft, color: T.dark }}>
                <p><strong>Terapia:</strong> {therapy.name}</p>
                <p><strong>Terapeuta:</strong> {selectedTherapist.name}</p>
                <p><strong>Quando:</strong> {selectedSlot.dateDisplay} às {selectedSlot.time}</p>
              </div>
            )}

            {/* Botão de confirmação */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition disabled:opacity-40 hover:brightness-110 shadow-sm"
              style={{ background: T.primary }}
            >
              <MessageCircle className="w-4 h-4" /> Confirmar via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TherapistsSection({
  therapists,
  therapies,
  appointments,
  onCompleteBooking,
}: {
  therapists: Therapist[];
  therapies: Therapy[];
  appointments: Appointment[];
  onCompleteBooking: (appt: Omit<Appointment, "id" | "status" | "createdAt">) => void;
}) {
  const [dayFilter, setDayFilter] = useState<string>("todos");
  const [query, setQuery] = useState("");
  const [quickBookingTherapist, setQuickBookingTherapist] = useState<Therapist | null>(null);

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
          eyebrow="Voluntariado"
          title="Nossos voluntários"
          subtitle="Terapeutas voluntários dedicados a acompanhar sua jornada de cuidado e autoconhecimento."
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
              <div key={p.id} className="rounded-2xl p-5 border flex flex-col justify-between" style={{ borderColor: T.border, background: T.card }}>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <TherapistAvatar therapist={p} />
                    <div>
                      <h3 className="font-semibold" style={{ color: T.dark }}>{p.name}</h3>
                      <p className="text-xs" style={{ color: T.textSoft }}>
                        {specialtyNames.length > 0 ? specialtyNames.join(" · ") : "Terapias Integrativas"}
                      </p>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: "rgba(0,0,0,0.04)", color: T.textSoft }}>
                          {p.modality === "presencial" ? (
                            <><MapPin className="w-3 h-3 text-emerald-700" /> Presencial</>
                          ) : p.modality === "distancia" ? (
                            <><Wifi className="w-3 h-3 text-emerald-700" /> A Distância</>
                          ) : (
                            <><Sparkles className="w-3 h-3 text-emerald-700" /> Presencial & A Distância</>
                          )}
                        </span>
                      </div>
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
                </div>
                <button
                  onClick={() => setQuickBookingTherapist(p)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110 mt-2"
                  style={{ background: T.primary }}
                >
                  <Zap className="w-4 h-4 text-amber-300" /> Agendar com {p.name.split(" ")[0]} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {quickBookingTherapist && (
        <QuickTherapistBookingModal
          therapist={quickBookingTherapist}
          therapies={therapies}
          appointments={appointments}
          onClose={() => setQuickBookingTherapist(null)}
          onComplete={(appt) => {
            onCompleteBooking(appt);
          }}
        />
      )}
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
      <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
        <Logo size={68} rounded="rounded-full" variant="soft" />
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
    { id: "terapeutas", label: "Terapeutas", icon: Users },
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const sorted = useMemo(() => {
    return [...appointments].sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sorted.filter((a) => {
      if (filterStatus === "faltas") {
        if (!a.status.startsWith("faltou")) return false;
      } else if (filterStatus !== "todos" && a.status !== filterStatus) {
        return false;
      }

      if (!q) return true;
      const th = therapists.find((p) => p.id === a.therapistId)?.name.toLowerCase() || "";
      const tp = therapies.find((t) => t.id === a.therapyId)?.name.toLowerCase() || "";
      const client = a.clientName.toLowerCase();
      const phone = a.clientPhone.toLowerCase();
      const secPhone = (a.secondaryPhone || "").toLowerCase();
      const dt = a.date.toLowerCase();
      return (
        client.includes(q) ||
        phone.includes(q) ||
        secPhone.includes(q) ||
        th.includes(q) ||
        tp.includes(q) ||
        dt.includes(q)
      );
    });
  }, [sorted, searchTerm, filterStatus, therapists, therapies]);

  const setStatus = (id: string, status: BookingStatus) => {
    setAppointments(appointments.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const handleDelete = (id: string) => {
    setAppointments(appointments.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  };

  // Contadores
  const countConfirmed = appointments.filter((a) => a.status === "confirmado").length;
  const countPending = appointments.filter((a) => a.status === "pendente").length;
  const countCancelled = appointments.filter((a) => a.status === "cancelado").length;
  const countLack1 = appointments.filter((a) => a.status === "faltou_1x").length;
  const countLack2 = appointments.filter((a) => a.status === "faltou_2x").length;
  const countLack3 = appointments.filter((a) => a.status === "faltou_3x").length;
  const totalLacks = countLack1 + countLack2 + countLack3;

  /** Identifica se o assistido tem faltas registradas em outros agendamentos cadastrados */
  const getClientLackHistoryCount = (clientName: string, clientPhone: string, currentApptId: string) => {
    const cName = clientName.trim().toLowerCase();
    const cPhone = clientPhone.replace(/\D/g, "");
    return appointments.filter((a) => {
      if (a.id === currentApptId) return false;
      const isLack = a.status === "faltou_1x" || a.status === "faltou_2x" || a.status === "faltou_3x";
      if (!isLack) return false;
      const matchPhone = cPhone.length >= 8 && a.clientPhone.replace(/\D/g, "").includes(cPhone.slice(-8));
      const matchName = cName.length >= 3 && a.clientName.trim().toLowerCase() === cName;
      return matchPhone || matchName;
    }).length;
  };

  return (
    <div className="space-y-4">
      {/* Barra de Estatísticas & Ações do Topo */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl border bg-white shadow-xs" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-gray-100" style={{ color: T.dark }}>
            Total: {appointments.length}
          </div>
          <div className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            {countConfirmed} Confirmados
          </div>
          {countPending > 0 && (
            <div className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
              {countPending} Pendentes
            </div>
          )}
          {totalLacks > 0 && (
            <div className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              <span>{totalLacks} Faltas ({countLack1 > 0 ? `${countLack1} 1x` : ""}{countLack2 > 0 ? ` · ${countLack2} 2x` : ""}{countLack3 > 0 ? ` · ${countLack3} 3x+` : ""})</span>
            </div>
          )}
          {countCancelled > 0 && (
            <div className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
              {countCancelled} Cancelados
            </div>
          )}
        </div>

        {/* Botão de Exportação Excel (.xlsx) */}
        <button
          type="button"
          onClick={() => setShowExcelModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-sm hover:brightness-110 hover:-translate-y-0.5"
          style={{ background: "#1D6F42" }}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Gerar Planilha Excel (.xlsx)</span>
        </button>
      </div>

      {/* Filtros de Busca & Status */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.textSoft }} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por paciente, telefone, terapeuta, terapia ou data..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium outline-none bg-white"
            style={{ borderColor: T.border, color: T.dark }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-xs font-medium outline-none bg-white font-semibold"
          style={{ borderColor: T.border, color: T.dark }}
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Apenas Pendentes</option>
          <option value="confirmado">Apenas Confirmados</option>
          <option value="faltas">Todas as Faltas ({totalLacks})</option>
          <option value="faltou_1x">Faltou (1ª vez)</option>
          <option value="faltou_2x">Faltou (2ª vez)</option>
          <option value="faltou_3x">Faltou (3ª vez ou +)</option>
          <option value="cancelado">Apenas Cancelados</option>
        </select>
      </div>

      {filteredAppointments.length === 0 ? (
        <EmptyState text={sorted.length === 0 ? "Nenhum agendamento registrado ainda." : "Nenhum agendamento corresponde aos filtros."} />
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((a) => {
            const therapy = therapies.find((t) => t.id === a.therapyId);
            const therapist = therapists.find((p) => p.id === a.therapistId);
            const clientFirstName = a.clientName.trim().split(" ")[0];
            const dateObj = a.date ? new Date(a.date + "T00:00:00") : null;
            const weekdayAbbr = dateObj
              ? dateObj.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
              : "";
            const capitalizedWeekday = weekdayAbbr ? weekdayAbbr.charAt(0).toUpperCase() + weekdayAbbr.slice(1) : "";
            const formattedDateStr = dateObj ? dateObj.toLocaleDateString("pt-BR") : a.date;
            const dateDisplay = capitalizedWeekday ? `${capitalizedWeekday} ${formattedDateStr}` : formattedDateStr;

            const isConfirmingDelete = confirmDeleteId === a.id;
            const previousLacks = getClientLackHistoryCount(a.clientName, a.clientPhone, a.id);
            const isLackStatus = a.status === "faltou_1x" || a.status === "faltou_2x" || a.status === "faltou_3x";

            // Mensagem de WhatsApp inteligente dependendo do status
            let waMsg = "";
            if (isLackStatus) {
              waMsg =
                `Olá ${clientFirstName}! Aqui é do CTV (Centro de Terapias Vibracionais).\n\n` +
                `Notamos que você não pôde comparecer à sua sessão de *${therapy?.name || "Terapia"}* com ${therapist?.name || ""} marcada para ${dateDisplay} às ${a.time}.\n\n` +
                `Está tudo bem por aí? Caso deseje remarcar para uma nova data, estamos à sua inteira disposição!`;
            } else {
              waMsg =
                `Olá ${clientFirstName}! Aqui é a Sheyla do CTV, sobre sua solicitação para agendamento:\n\n` +
                `*${therapy?.name || "Terapia"}*\n` +
                `Terapeuta: ${therapist?.name || ""}\n` +
                `${dateDisplay}\n` +
                `às ${a.time}\n\n` +
                `Posso confirmar agora?\n` +
                `Se precisar de mais alguma informação, pode enviar um áudio que responderei o mais breve possível.`;
            }

            return (
              <div
                key={a.id}
                className="rounded-2xl p-4 border flex flex-col lg:flex-row lg:items-center gap-4 justify-between transition hover:shadow-xs"
                style={{
                  borderColor: isLackStatus ? "#FCD34D" : T.border,
                  background: isLackStatus ? "#FFFDF5" : T.card,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="font-bold text-sm sm:text-base" style={{ color: T.dark }}>
                      {a.clientName}
                    </p>
                    <StatusBadge status={a.status} />
                  </div>

                  <p className="text-sm font-medium" style={{ color: T.text }}>
                    {therapy?.name} · <span className="font-semibold">{therapist?.name}</span>
                  </p>
                  
                  <p className="text-xs mt-1 font-medium" style={{ color: T.textSoft }}>
                    📅 {dateDisplay} às {a.time} · {a.modality === "presencial" ? "🏢 Presencial" : "🌐 A Distância"}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                    <span className="font-semibold flex items-center gap-1" style={{ color: T.dark }}>
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      {maskPhone(a.clientPhone) || a.clientPhone}
                    </span>

                    {a.secondaryPhone && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 flex items-center gap-1 border" style={{ borderColor: T.border }}>
                        <PhoneCall className="w-3 h-3 text-gray-500" />
                        Recado: {maskPhone(a.secondaryPhone)}
                      </span>
                    )}
                  </div>

                  {/* Alerta de Histórico de Faltas do Assistido */}
                  {previousLacks > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 mt-2 font-medium">
                      <History className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>
                        <strong>Atenção da Recepção:</strong> Este assistido já possui {previousLacks} falta(s) registrada(s) em outros atendimentos.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Seletor com todos os Níveis de Falta */}
                  <select
                    value={a.status}
                    onChange={(e) => setStatus(a.id, e.target.value as BookingStatus)}
                    className="text-xs font-semibold rounded-xl border px-3 py-2 outline-none bg-white shadow-2xs cursor-pointer"
                    style={{ borderColor: T.border, color: T.dark }}
                  >
                    <option value="pendente">⏳ Pendente</option>
                    <option value="confirmado">✅ Confirmado</option>
                    <option value="faltou_1x">⚠️ Faltou (1ª vez)</option>
                    <option value="faltou_2x">🟠 Faltou (2ª vez)</option>
                    <option value="faltou_3x">🔴 Faltou (3ª vez+)</option>
                    <option value="cancelado">❌ Cancelado</option>
                  </select>

                  {/* WhatsApp Principal */}
                  <a
                    href={getWhatsAppUrl(a.clientPhone, waMsg)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white transition hover:brightness-110 shadow-xs"
                    style={{ background: "#25D366" }}
                    title="Conversar no WhatsApp"
                  >
                    <Phone className="w-3.5 h-3.5" /> WhatsApp
                  </a>

                  {/* WhatsApp Secundário se existir */}
                  {a.secondaryPhone && (
                    <a
                      href={getWhatsAppUrl(a.secondaryPhone, waMsg)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-xl text-emerald-800 bg-emerald-50 border border-emerald-200 transition hover:bg-emerald-100"
                      title="WhatsApp do Telefone de Recado"
                    >
                      <PhoneCall className="w-3 h-3" /> Recado
                    </a>
                  )}

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200 animate-[fadeIn_.15s_ease]">
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1.5 text-xs rounded-lg border bg-white hover:bg-black/5 text-gray-700 transition"
                        style={{ borderColor: T.border }}
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(a.id)}
                      className="p-2 rounded-xl border hover:bg-rose-50 text-rose-600 transition"
                      style={{ borderColor: T.border }}
                      title="Excluir agendamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Exportação Excel */}
      {showExcelModal && (
        <ExcelExportModal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          appointments={appointments}
          therapists={therapists}
          therapies={therapies}
        />
      )}
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
    const list = sortByName(therapies);
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q));
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

  const sortedTherapists = useMemo(() => sortByName(therapists), [therapists]);

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
      <FormField label="Benefícios"><Input value={benefits} onChange={setBenefits} placeholder="Ex: Alívio de tensões, clareza mental, vitalidade" /></FormField>
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
        {sortedTherapists.length === 0 ? (
          <p className="text-xs" style={{ color: T.textSoft }}>Nenhum terapeuta cadastrado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedTherapists.map((p) => (
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
    const list = sortByName(therapists);
    if (!q) return list;
    return list.filter((p) => {
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
                  <p className="text-xs truncate flex items-center gap-1.5" style={{ color: T.textSoft }}>
                    <span>{activeDays.join(", ") || "Sem horários cadastrados"}</span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-800">
                      {p.modality === "presencial"
                        ? "Apenas Presencial"
                        : p.modality === "distancia"
                        ? "Apenas A Distância"
                        : "Presencial & Distância"}
                    </span>
                  </p>
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
  const [modality, setModality] = useState<Modality>(initial?.modality ?? "ambas");
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
          modality,
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
      <FormField label="Modalidade de atendimento deste terapeuta">
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value as Modality)}
          className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none bg-white"
          style={{ borderColor: T.border, color: T.text }}
        >
          <option value="ambas">Ambas (Presencial e A Distância)</option>
          <option value="presencial">Apenas Presencial</option>
          <option value="distancia">Apenas A Distância</option>
        </select>
      </FormField>
      <FormField label="Especialidades">
        <div className="flex flex-wrap gap-2">
          {sortByName(therapies).map((t) => (
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

  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    setMessage("Sincronizando todos os dados com o Firebase Firestore...");
    try {
      for (const t of therapies) {
        await saveDocument("therapies", t.id, t);
      }
      for (const p of therapists) {
        await saveDocument("therapists", p.id, p);
      }
      for (const a of appointments) {
        await saveDocument("appointments", a.id, a);
      }
      for (const f of faqs) {
        await saveDocument("faqs", f.id, f);
      }
      setMessage(`Sincronização concluída! ${therapists.length} terapeutas e ${therapies.length} terapias já estão salvos e sincronizados na nuvem.`);
    } catch (e: any) {
      setMessage(`Erro ao sincronizar: ${e?.message || "Tente novamente"}`);
    } finally {
      setSyncing(false);
    }
  };

  const logoFileRef = useRef<HTMLInputElement>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem("ctv_custom_logo");
    } catch {
      return null;
    }
  });

  const handleUploadLogo = async (file: File) => {
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 800, 0.95);
      localStorage.setItem("ctv_custom_logo", dataUrl);
      setCurrentLogo(dataUrl);
      window.dispatchEvent(new Event("ctv-logo-updated"));
      setMessage("Logotipo atualizado com sucesso em todo o portal!");
    } catch {
      setMessage("Erro ao processar imagem da logo.");
    }
  };

  const handleResetLogo = () => {
    localStorage.removeItem("ctv_custom_logo");
    setCurrentLogo(null);
    window.dispatchEvent(new Event("ctv-logo-updated"));
    setMessage("Logotipo redefinido para o padrão.");
  };

  return (
    <div className="space-y-4 max-w-xl">
      {message && (
        <div className="rounded-xl p-3.5 text-sm flex items-center justify-between gap-2" style={{ background: T.primarySoft, color: T.dark }}>
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-semibold underline">OK</button>
        </div>
      )}

      {/* Logotipo do Portal */}
      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <p className="font-semibold mb-1.5" style={{ color: T.dark }}>Logotipo do CTV</p>
        <p className="text-sm mb-4" style={{ color: T.textSoft }}>
          O sistema carrega automaticamente imagens salvas na pasta <code>public/logo.png</code> ou <code>public/logo.svg</code>, ou você pode fazer upload direto da imagem oficial abaixo:
        </p>
        
        <div className="flex items-center gap-4 p-3 rounded-xl border bg-white/60 mb-4" style={{ borderColor: T.border }}>
          <Logo size={60} rounded="rounded-full" variant="soft" />
          <div className="text-xs" style={{ color: T.textSoft }}>
            <p className="font-medium" style={{ color: T.dark }}>Status da Logo:</p>
            <p>{currentLogo ? "Usando logotipo personalizado (upload)" : "Usando imagem da pasta public/ ou símbolo padrão"}</p>
          </div>
        </div>

        <input
          ref={logoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUploadLogo(e.target.files[0])}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => logoFileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: T.primary }}
          >
            <ImageIcon className="w-4 h-4" /> Enviar nova imagem da Logo
          </button>
          {currentLogo && (
            <button
              onClick={handleResetLogo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition hover:bg-black/5"
              style={{ borderColor: T.border, color: T.dark }}
            >
              <Trash2 className="w-4 h-4" /> Restaurar padrão
            </button>
          )}
        </div>
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: T.border, background: T.card }}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold" style={{ color: T.dark }}>Banco de Dados em Nuvem</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Cloud className="w-3.5 h-3.5" /> Firebase Firestore Ativo
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: T.textSoft }}>
          Todas as alterações de terapias, fotos dos terapeutas, horários e agendamentos são sincronizadas em tempo real na nuvem e aparecem instantaneamente em qualquer celular ou computador.
        </p>
        <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2" style={{ borderColor: T.border }}>
          <span className="text-xs" style={{ color: T.textSoft }}>
            Cadastros ativos: <b>{therapists.length}</b> terapeutas · <b>{therapies.length}</b> terapias
          </span>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ background: T.primary }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Forçar sincronização com Nuvem"}
          </button>
        </div>
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
function Input({ value, onChange, required, placeholder }: { value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <input
      value={value}
      required={required}
      placeholder={placeholder}
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
function VibrationalHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl mb-8 px-6 py-10 sm:px-12 sm:py-14 text-center" style={{ background: `linear-gradient(180deg, ${T.primarySoft}, ${T.bg})` }}>
      <div className="relative w-32 h-32 mx-auto mb-5 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite]" style={{ border: `1.5px solid ${T.primary}` }} />
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite_1s]" style={{ border: `1.5px solid ${T.primary}` }} />
        <span className="absolute inset-0 rounded-full animate-[ripple_3s_ease-out_infinite_2s]" style={{ border: `1.5px solid ${T.primary}` }} />
        <div className="w-20 h-20 flex items-center justify-center">
          <Logo size={80} rounded="rounded-full" variant="soft" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: T.primary }}>Centro de Terapias Vibracionais</p>
      <h1 className="text-2xl sm:text-4xl font-semibold mb-3 max-w-xl mx-auto leading-tight" style={{ color: T.dark, fontFamily: "Fraunces, serif" }}>
        Um espaço para reencontrar seu equilíbrio
      </h1>
      <p className="text-sm sm:text-base max-w-md mx-auto mb-6" style={{ color: T.textSoft }}>
        Terapias vibracionais conduzidas com presença, acolhimento e escuta atenta, presencial ou a distância.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border shadow-xs" style={{ background: "rgba(255, 255, 255, 0.85)", borderColor: "#8FA874", color: T.dark }}>
        <ArrowDown className="w-3.5 h-3.5 text-emerald-800 animate-bounce" />
        <span>Selecione uma das opções abaixo para iniciar sua jornada:</span>
      </div>
    </div>
  );
}

/* =========================================================================
   NAVEGAÇÃO
   ========================================================================= */
type View = "inicio" | "terapias" | "terapeutas" | "sac" | "admin";

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
    { id: "terapias", label: "Terapias", icon: LayoutGrid },
    { id: "terapeutas", label: "Terapeutas", icon: Users },
    { id: "sac", label: "SAC", icon: MessageCircle },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: `${T.bg}E6`, borderColor: T.border }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => setView("inicio")} className="flex items-center gap-2.5 group text-left">
          <Logo size={36} rounded="rounded-full" variant="soft" className="transition group-hover:scale-105" />
          <div>
            <span className="font-bold text-xs sm:text-sm tracking-wide block uppercase" style={{ color: T.dark, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              CTV - CENTRO DE TERAPIAS VIBRACIONAIS
            </span>
          </div>
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

  const [a11y, setA11y] = useState<A11yState>({ fontScale: 1, highContrast: false, rulerActive: false });
  const [isSpeakingPage, setIsSpeakingPage] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Aplica o redimensionamento de fonte globalmente no HTML para que todas as classes Tailwind (rem) escalem
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * a11y.fontScale}px`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [a11y.fontScale]);

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

      <ReadingRuler
        active={a11y.rulerActive}
        onClose={() => setA11y((s) => ({ ...s, rulerActive: false }))}
      />

      <Header view={view} setView={setView} />

      <main ref={mainRef} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {view === "inicio" && (
          <>
            <VibrationalHero />
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              {[
                {
                  icon: LayoutGrid,
                  badge: "Catálogo & Agendamento",
                  label: "Terapias",
                  desc: "Conheça nossas práticas vibracionais e solicite sua sessão.",
                  action: () => setView("terapias"),
                },
                {
                  icon: Users,
                  badge: "Nossa Equipe",
                  label: "Nossos Voluntários",
                  desc: "Consulte o perfil dos terapeutas e horários disponíveis.",
                  action: () => setView("terapeutas"),
                },
                {
                  icon: MessageCircle,
                  badge: "Atendimento & Dúvidas",
                  label: "SAC",
                  desc: "Perguntas frequentes e canal de suporte via WhatsApp.",
                  action: () => setView("sac"),
                },
              ].map((c, i) => (
                <button
                  key={i}
                  onClick={c.action}
                  className="group text-left rounded-2xl p-5 border-2 transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                  style={{
                    borderColor: "#8BA470",
                    background: T.card,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition group-hover:scale-110 shadow-xs"
                        style={{ background: T.primarySoft, color: T.primary }}
                      >
                        <c.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: T.primarySoft, color: T.dark }}>
                        {c.badge}
                      </span>
                    </div>
                    <p className="font-bold text-base mb-1.5" style={{ color: T.dark }}>{c.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: T.textSoft }}>{c.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold" style={{ borderColor: "#D5E3C5", color: T.primary }}>
                    <span>Acessar {c.label.toLowerCase()}</span>
                    <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "terapias" && (
          <TherapyCatalog
            therapies={therapies}
            therapists={therapists}
            appointments={appointments}
            onCompleteBooking={handleBookingComplete}
          />
        )}

        {view === "terapeutas" && (
          <TherapistsSection
            therapists={therapists}
            therapies={therapies}
            appointments={appointments}
            onCompleteBooking={handleBookingComplete}
          />
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

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center flex flex-col items-center gap-2.5">
        <Logo size={44} rounded="rounded-full" variant="soft" />
        <p className="text-xs" style={{ color: T.textSoft }}>Centro de Terapias Vibracionais · Natal, RN, Brasil · Cuidado, presença e equilíbrio.</p>
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
