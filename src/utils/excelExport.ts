import ExcelJS from "exceljs";
import { Appointment, Therapist, Therapy, WEEKDAYS, formatTwoNames } from "../types";

export interface ExcelExportOptions {
  mode: "semanal" | "mensal" | "dia";
  referenceDate: string; // YYYY-MM-DD
  includeEmptySlots: boolean;
  statusFilter: "todos" | "confirmados_e_pendentes" | "apenas_confirmados" | "confirmados_e_faltas" | "apenas_faltas";
}

/** Retorna o nome do dia da semana em português maiúsculo formatado para o cabeçalho amarelo */
export function getWeekdayNamePt(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayIndex = dt.getDay(); // 0 = Domingo, 1 = Segunda, ...
  const map: Record<number, string> = {
    0: "DOMINGO",
    1: "SEGUNDA FEIRA",
    2: "TERÇA FEIRA",
    3: "QUARTA FEIRA",
    4: "QUINTA FEIRA",
    5: "SEXTA FEIRA",
    6: "SÁBADO",
  };
  return map[dayIndex] || "DATA";
}

/** Formata data para DD/MM/YYYY */
export function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(m)}/${y}`;
}

/** Mapeia dia da semana para o formato usado no objeto Therapist (ex: "Segunda", "Terça") */
export function getTherapistWeekdayKey(dateStr: string): string | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayIndex = dt.getDay();
  const map: Record<number, string> = {
    1: "Segunda",
    2: "Terça",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sábado",
  };
  return map[dayIndex] || null;
}

/** Retorna as datas de uma semana (Segunda a Sábado) que contenha a data de referência */
export function getWeekDates(referenceDateStr: string): string[] {
  const [y, m, d] = referenceDateStr.split("-").map(Number);
  const current = new Date(y, m - 1, d);
  const day = current.getDay(); // 0 = Dom, 1 = Seg...
  
  // Encontra a segunda-feira correspondente
  const monday = new Date(current);
  const diffToMonday = day === 0 ? -6 : 1 - day;
  monday.setDate(current.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 6; i++) { // Segunda até Sábado (6 dias)
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const yStr = dt.getFullYear();
    const mStr = String(dt.getMonth() + 1).padStart(2, "0");
    const dStr = String(dt.getDate()).padStart(2, "0");
    dates.push(`${yStr}-${mStr}-${dStr}`);
  }
  return dates;
}

/** Retorna todas as datas (Segunda a Sábado) de um mês */
export function getMonthDates(referenceDateStr: string): string[] {
  const [y, m] = referenceDateStr.split("-").map(Number);
  const dates: string[] = [];
  const daysInMonth = new Date(y, m, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(y, m - 1, day);
    if (dt.getDay() !== 0) { // Exclui domingo
      const dStr = String(day).padStart(2, "0");
      const mStr = String(m).padStart(2, "0");
      dates.push(`${y}-${mStr}-${dStr}`);
    }
  }
  return dates;
}

export interface BlockRow {
  hora: string;
  assistido: string;
  fone: string;
  modalidade: string;
  status?: string;
}

export interface TherapistDayBlock {
  therapistName: string;
  specialtyLabel?: string;
  rows: BlockRow[];
}

export interface DaySchedule {
  date: string;
  headerTitle: string; // Ex: "QUINTA FEIRA 20/08/2026"
  blocks: TherapistDayBlock[];
}

/**
 * Constrói a estrutura lógica de dados de um dia conforme o modelo do CTV
 */
export function buildDaySchedule(
  dateStr: string,
  therapists: Therapist[],
  therapies: Therapy[],
  appointments: Appointment[],
  options: { includeEmptySlots: boolean; statusFilter: ExcelExportOptions["statusFilter"] }
): DaySchedule {
  const headerTitle = `${getWeekdayNamePt(dateStr)} ${formatDateBr(dateStr)}`;
  const weekdayKey = getTherapistWeekdayKey(dateStr);

  const apptsForDate = appointments.filter((a) => {
    if (a.date !== dateStr) return false;
    if (options.statusFilter === "apenas_confirmados") return a.status === "confirmado";
    if (options.statusFilter === "confirmados_e_pendentes") return a.status === "confirmado" || a.status === "pendente";
    if (options.statusFilter === "confirmados_e_faltas") return a.status === "confirmado" || a.status.startsWith("faltou");
    if (options.statusFilter === "apenas_faltas") return a.status.startsWith("faltou");
    return true; // "todos"
  });

  const blocks: TherapistDayBlock[] = [];

  // Terapeutas ativos ordenados por nome
  const activeTherapists = [...therapists]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  for (const th of activeTherapists) {
    const isBlocked = (th.unavailableDates ?? []).includes(dateStr);
    const daySlots = (!isBlocked && weekdayKey && th.availability[weekdayKey]) ? [...th.availability[weekdayKey]].sort() : [];

    const thAppts = apptsForDate.filter((a) => a.therapistId === th.id);

    // Se o terapeuta não tem horários nem agendamentos neste dia, pula
    if (daySlots.length === 0 && thAppts.length === 0) {
      continue;
    }

    // Identifica nome do bloco (ex: "BETTY CATUCCI" ou "CARMEM (YOGA)")
    let blockTitle = th.name.toUpperCase();
    const thTherapies = therapies.filter((tp) => th.specialties.includes(tp.id));
    if (thTherapies.length === 1 && thTherapies[0].name.toLowerCase().includes("yoga")) {
      blockTitle = `${th.name.toUpperCase()} (YOGA)`;
    }

    const rows: BlockRow[] = [];

    // Mapeamento por horário
    if (options.includeEmptySlots) {
      // Começamos pelos horários regulares do terapeuta
      const allTimesSet = new Set([...daySlots, ...thAppts.map((a) => a.time)]);
      const sortedTimes = Array.from(allTimesSet).sort();

      for (const time of sortedTimes) {
        const timeFormatted = time.replace(":", "h").replace(/h00$/, "h");
        const matchingAppts = thAppts.filter((a) => a.time === time);

        if (matchingAppts.length > 0) {
          matchingAppts.forEach((appt, idx) => {
            rows.push({
              hora: idx === 0 ? timeFormatted : "", // repete em branco se múltiplos no mesmo horário como yoga
              assistido: formatTwoNames(appt.clientName).toUpperCase(),
              fone: appt.clientPhone,
              modalidade: appt.modality === "presencial" ? "PRESENCIAL" : "DISTANCIA",
              status: appt.status,
            });
          });
        } else {
          // Horário vago
          rows.push({
            hora: timeFormatted,
            assistido: "",
            fone: "",
            modalidade: "",
          });
        }
      }
    } else {
      // Apenas horários com agendamentos
      const sortedAppts = [...thAppts].sort((a, b) => a.time.localeCompare(b.time));
      for (const appt of sortedAppts) {
        const timeFormatted = appt.time.replace(":", "h").replace(/h00$/, "h");
        rows.push({
          hora: timeFormatted,
          assistido: formatTwoNames(appt.clientName).toUpperCase(),
          fone: appt.clientPhone,
          modalidade: appt.modality === "presencial" ? "PRESENCIAL" : "DISTANCIA",
          status: appt.status,
        });
      }
    }

    if (rows.length > 0) {
      blocks.push({
        therapistName: blockTitle,
        rows,
      });
    }
  }

  return {
    date: dateStr,
    headerTitle,
    blocks,
  };
}

/**
 * Renderiza os blocos de um dia em uma planilha ExcelJS com estilização idêntica à foto
 */
function renderDayToWorksheet(ws: ExcelJS.Worksheet, daySchedule: DaySchedule, startRow: number = 1): number {
  let currentRow = startRow;

  // 1. Linha do Dia (Amarelo Ouro / Dourado)
  const headerRow = ws.getRow(currentRow);
  headerRow.height = 28;
  ws.mergeCells(currentRow, 1, currentRow, 4);

  const titleCell = ws.getCell(currentRow, 1);
  titleCell.value = daySchedule.headerTitle;
  titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD8A92A" }, // Amarelo Dourado Ouro exatamente como no modelo
  };
  
  // Bordas para o cabeçalho amarelo
  for (let c = 1; c <= 4; c++) {
    ws.getCell(currentRow, c).border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };
  }

  currentRow++;

  if (daySchedule.blocks.length === 0) {
    const emptyRow = ws.getRow(currentRow);
    emptyRow.height = 22;
    ws.mergeCells(currentRow, 1, currentRow, 4);
    const emptyCell = ws.getCell(currentRow, 1);
    emptyCell.value = "SEM AGENDAMENTOS REGISTRADOS PARA ESTA DATA";
    emptyCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF666666" } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    currentRow += 2;
    return currentRow;
  }

  // 2. Blocos de cada terapeuta
  for (const block of daySchedule.blocks) {
    // Linha do Nome do Terapeuta (Fundo Azul Turquesa / Ciano do modelo)
    const thRow = ws.getRow(currentRow);
    thRow.height = 24;
    ws.mergeCells(currentRow, 1, currentRow, 4);

    const thCell = ws.getCell(currentRow, 1);
    thCell.value = block.therapistName;
    thCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF000000" } };
    thCell.alignment = { horizontal: "center", vertical: "middle" };
    thCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5FAFB9" }, // Azul Turquesa do modelo original
    };

    for (let c = 1; c <= 4; c++) {
      ws.getCell(currentRow, c).border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
    }

    currentRow++;

    // Subcabeçalho das colunas: HORA | ASSISTIDO | FONE | MODALIDADE
    const subRow = ws.getRow(currentRow);
    subRow.height = 20;

    const subHeaders = [
      { col: 1, text: "HORA", width: 12 },
      { col: 2, text: "ASSISTIDO", width: 34 },
      { col: 3, text: "FONE", width: 22 },
      { col: 4, text: "", width: 18 }, // A coluna 4 no modelo não tem título ou é MODALIDADE
    ];

    for (const sh of subHeaders) {
      const cell = ws.getCell(currentRow, sh.col);
      cell.value = sh.text;
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cell.alignment = {
        horizontal: sh.col === 1 ? "center" : sh.col === 2 ? "center" : "center",
        vertical: "middle",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF83C6CE" }, // Azul claro correspondente aos subcabeçalhos
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }

    currentRow++;

    // Linhas de dados do bloco
    for (const row of block.rows) {
      const dataRow = ws.getRow(currentRow);
      dataRow.height = 20;

      // Coluna 1: HORA
      const cellHora = ws.getCell(currentRow, 1);
      cellHora.value = row.hora;
      cellHora.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cellHora.alignment = { horizontal: "center", vertical: "middle" };

      // Coluna 2: ASSISTIDO
      const cellAssistido = ws.getCell(currentRow, 2);
      cellAssistido.value = row.assistido;
      cellAssistido.font = { name: "Arial", size: 10, bold: false, color: { argb: "FF000000" } };
      cellAssistido.alignment = { horizontal: "left", vertical: "middle" };

      // Coluna 3: FONE
      const cellFone = ws.getCell(currentRow, 3);
      cellFone.value = row.fone;
      cellFone.font = { name: "Arial", size: 10, bold: false, color: { argb: "FF000000" } };
      cellFone.alignment = { horizontal: "left", vertical: "middle" };

      // Coluna 4: MODALIDADE (DISTANCIA / PRESENCIAL)
      const cellMod = ws.getCell(currentRow, 4);
      cellMod.value = row.modalidade;
      cellMod.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cellMod.alignment = { horizontal: "left", vertical: "middle" };

      // Bordas pretas sólidas clássicas da planilha
      for (let c = 1; c <= 4; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      }

      currentRow++;
    }

    // Linha em branco separadora entre blocos de terapeutas
    currentRow++;
  }

  return currentRow;
}

/**
 * Gera e baixa o arquivo Excel completo (.xlsx)
 */
export async function generateAndDownloadExcel(
  options: ExcelExportOptions,
  therapists: Therapist[],
  therapies: Therapy[],
  appointments: Appointment[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CTV - Centro de Terapias Vibracionais";
  workbook.lastModifiedBy = "CTV Admin";
  workbook.created = new Date();
  workbook.modified = new Date();

  const setColumnProperties = (ws: ExcelJS.Worksheet) => {
    ws.columns = [
      { key: "hora", width: 12 },
      { key: "assistido", width: 34 },
      { key: "fone", width: 24 },
      { key: "modalidade", width: 20 },
    ];
    ws.views = [{ showGridLines: true }];
  };

  if (options.mode === "dia") {
    const daySchedule = buildDaySchedule(options.referenceDate, therapists, therapies, appointments, options);
    const sheetName = `${getWeekdayNamePt(options.referenceDate).slice(0, 3)} ${formatDateBr(options.referenceDate).slice(0, 5)}`.replace(/\//g, "-");
    const ws = workbook.addWorksheet(sheetName);
    setColumnProperties(ws);
    renderDayToWorksheet(ws, daySchedule, 1);
  } else if (options.mode === "semanal") {
    const weekDates = getWeekDates(options.referenceDate);

    // Cria uma aba para cada dia útil da semana (Segunda a Sábado)
    for (const dStr of weekDates) {
      const daySchedule = buildDaySchedule(dStr, therapists, therapies, appointments, options);
      const weekdayShort = getWeekdayNamePt(dStr).split(" ")[0]; // "SEGUNDA", "TERÇA", etc.
      const formattedDate = formatDateBr(dStr).slice(0, 5).replace("/", "-");
      const sheetName = `${weekdayShort} ${formattedDate}`;

      const ws = workbook.addWorksheet(sheetName);
      setColumnProperties(ws);
      renderDayToWorksheet(ws, daySchedule, 1);
    }

    // Adiciona também uma aba "Semana Completa" com todos os dias juntos em sequência
    const fullWeekWs = workbook.addWorksheet("Visão Semanal Completa");
    setColumnProperties(fullWeekWs);
    let curRow = 1;
    for (const dStr of weekDates) {
      const daySchedule = buildDaySchedule(dStr, therapists, therapies, appointments, options);
      curRow = renderDayToWorksheet(fullWeekWs, daySchedule, curRow);
      curRow++; // Espaço entre dias
    }
  } else if (options.mode === "mensal") {
    const monthDates = getMonthDates(options.referenceDate);
    const [y, m] = options.referenceDate.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthName = monthNames[Number(m) - 1] || m;

    // 1. Aba Consolidada do Mês Inteiro
    const fullMonthWs = workbook.addWorksheet(`${monthName} ${y}`);
    setColumnProperties(fullMonthWs);
    let curRow = 1;
    for (const dStr of monthDates) {
      const daySchedule = buildDaySchedule(dStr, therapists, therapies, appointments, options);
      curRow = renderDayToWorksheet(fullMonthWs, daySchedule, curRow);
      curRow++;
    }

    // 2. Abas separadas para cada dia com atendimentos/escalas
    for (const dStr of monthDates) {
      const daySchedule = buildDaySchedule(dStr, therapists, therapies, appointments, options);
      if (daySchedule.blocks.length > 0) {
        const weekdayShort = getWeekdayNamePt(dStr).split(" ")[0].slice(0, 3);
        const formattedDate = formatDateBr(dStr).slice(0, 5).replace("/", "-");
        const sheetName = `${formattedDate} (${weekdayShort})`;
        // Excel worksheet name max 31 chars
        const safeName = sheetName.slice(0, 31);
        
        // Evita duplicatas de nome
        if (!workbook.getWorksheet(safeName)) {
          const ws = workbook.addWorksheet(safeName);
          setColumnProperties(ws);
          renderDayToWorksheet(ws, daySchedule, 1);
        }
      }
    }
  }

  // Gera o buffer e dispara o download no navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const modeLabel = options.mode === "mensal" ? "Mensal" : options.mode === "semanal" ? "Semanal" : "Diario";
  const dateFormatted = options.referenceDate.replace(/-/g, "");
  a.download = `CTV_Planilha_${modeLabel}_${dateFormatted}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
