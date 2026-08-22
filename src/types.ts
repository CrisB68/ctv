export type Modality = "presencial" | "distancia" | "ambas";
export type IconKey = "sparkles" | "handheart" | "users" | "gem" | "flower";

export interface Therapy {
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

export interface Therapist {
  id: string;
  name: string;
  photoUrl?: string;
  modality?: Modality; // "presencial" | "distancia" | "ambas"
  specialties: string[]; // therapy ids
  availability: Record<string, string[]>; // dia da semana -> lista de horários (ex.: "Segunda": ["09:00","10:00"])
  unavailableDates?: string[]; // datas específicas (YYYY-MM-DD) em que o terapeuta, excepcionalmente, não atende
  hidden: boolean;
  isSeed?: boolean;
}

export type BookingStatus =
  | "pendente"
  | "confirmado"
  | "cancelado"
  | "faltou_1x"
  | "faltou_2x"
  | "faltou_3x";

export interface Appointment {
  id: string;
  therapyId: string;
  therapistId: string;
  date: string;
  time: string;
  modality: "presencial" | "distancia";
  clientName: string;
  clientPhone: string;
  secondaryPhone?: string;
  status: BookingStatus;
  createdAt: string;
  isSeed?: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  hidden: boolean;
  isSeed?: boolean;
}

export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const T = {
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

/** Formata e limita o nome do cliente a no máximo dois nomes (Primeiro Nome + Sobrenome) para manter a planilha e grade concisas */
export function formatTwoNames(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
}

