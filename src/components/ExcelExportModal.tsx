import React, { useState, useMemo } from "react";
import {
  X, Download, Calendar, FileSpreadsheet, Sparkles, Check, ChevronLeft,
  ChevronRight, Eye, Info, CheckCircle2, ListFilter
} from "lucide-react";
import { Appointment, Therapist, Therapy, T } from "../types";
import {
  ExcelExportOptions,
  buildDaySchedule,
  generateAndDownloadExcel,
  getWeekDates,
  getMonthDates,
  getWeekdayNamePt,
  formatDateBr,
} from "../utils/excelExport";

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  therapists: Therapist[];
  therapies: Therapy[];
  appointments: Appointment[];
}

export function ExcelExportModal({
  isOpen,
  onClose,
  therapists,
  therapies,
  appointments,
}: ExcelExportModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [mode, setMode] = useState<"semanal" | "mensal" | "dia">("semanal");
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);
  const [includeEmptySlots, setIncludeEmptySlots] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<ExcelExportOptions["statusFilter"]>("confirmados_e_pendentes");
  const [previewDayIndex, setPreviewDayIndex] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Lista de datas incluídas de acordo com o modo
  const activeDates = useMemo(() => {
    if (mode === "dia") return [referenceDate];
    if (mode === "semanal") return getWeekDates(referenceDate);
    return getMonthDates(referenceDate);
  }, [mode, referenceDate]);

  // Data atual da prévia
  const currentPreviewDate = activeDates[Math.min(previewDayIndex, activeDates.length - 1)] || referenceDate;

  // Prévia dos bloquinhos para a data selecionada
  const previewSchedule = useMemo(() => {
    return buildDaySchedule(currentPreviewDate, therapists, therapies, appointments, {
      includeEmptySlots,
      statusFilter,
    });
  }, [currentPreviewDate, therapists, therapies, appointments, includeEmptySlots, statusFilter]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setDownloadSuccess(false);
      await generateAndDownloadExcel(
        {
          mode,
          referenceDate,
          includeEmptySlots,
          statusFilter,
        },
        therapists,
        therapies,
        appointments
      );
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error("Erro ao exportar planilha:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Atalhos de datas
  const setThisWeek = () => {
    setReferenceDate(todayStr);
    setPreviewDayIndex(0);
  };
  const setNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setReferenceDate(d.toISOString().slice(0, 10));
    setPreviewDayIndex(0);
  };
  const setThisMonth = () => {
    setReferenceDate(todayStr);
    setPreviewDayIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-[fadeIn_.15s_ease]">
      <div
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden"
        style={{ borderColor: T.border }}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border, background: T.primarySoft }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white shadow-xs" style={{ color: "#1D6F42" }}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg" style={{ color: T.dark }}>
                Exportar Grade & Planilha Excel (.xlsx)
              </h3>
              <p className="text-xs" style={{ color: T.textSoft }}>
                Gera o arquivo formatado exatamente no modelo oficial dos blocos do CTV.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Configuração de Exportação */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Escolha do Período */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textSoft }}>
                1. Tipo de Exportação
              </label>
              <div className="flex rounded-xl border p-1 bg-gray-50" style={{ borderColor: T.border }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("semanal");
                    setPreviewDayIndex(0);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                    mode === "semanal" ? "bg-white shadow-xs text-emerald-900 border" : "text-gray-600 hover:text-gray-900"
                  }`}
                  style={{ borderColor: mode === "semanal" ? T.border : "transparent" }}
                >
                  Semanal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("mensal");
                    setPreviewDayIndex(0);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                    mode === "mensal" ? "bg-white shadow-xs text-emerald-900 border" : "text-gray-600 hover:text-gray-900"
                  }`}
                  style={{ borderColor: mode === "mensal" ? T.border : "transparent" }}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("dia");
                    setPreviewDayIndex(0);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                    mode === "dia" ? "bg-white shadow-xs text-emerald-900 border" : "text-gray-600 hover:text-gray-900"
                  }`}
                  style={{ borderColor: mode === "dia" ? T.border : "transparent" }}
                >
                  Dia Único
                </button>
              </div>
            </div>

            {/* Data de Referência */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textSoft }}>
                2. Data de Referência
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => {
                  setReferenceDate(e.target.value);
                  setPreviewDayIndex(0);
                }}
                className="w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none bg-white"
                style={{ borderColor: T.border, color: T.dark }}
              />
              <div className="flex gap-1 mt-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={setThisWeek}
                  className="text-[11px] px-2 py-0.5 rounded-md border text-emerald-900 bg-white hover:bg-emerald-50"
                  style={{ borderColor: T.border }}
                >
                  Esta Semana
                </button>
                <button
                  type="button"
                  onClick={setNextWeek}
                  className="text-[11px] px-2 py-0.5 rounded-md border text-emerald-900 bg-white hover:bg-emerald-50"
                  style={{ borderColor: T.border }}
                >
                  Próxima Semana
                </button>
              </div>
            </div>

            {/* Opções de Conteúdo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textSoft }}>
                3. Filtros & Opções
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none bg-white mb-2"
                style={{ borderColor: T.border, color: T.dark }}
              >
                <option value="confirmados_e_pendentes">Confirmados e Pendentes</option>
                <option value="apenas_confirmados">Apenas Confirmados</option>
                <option value="confirmados_e_faltas">Confirmados + Registros de Falta</option>
                <option value="apenas_faltas">Apenas Faltas</option>
                <option value="todos">Todos os Agendamentos</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium" style={{ color: T.dark }}>
                <input
                  type="checkbox"
                  checked={includeEmptySlots}
                  onChange={(e) => setIncludeEmptySlots(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-700"
                />
                <span>Incluir horários vagos dos terapeutas</span>
              </label>
            </div>
          </div>

          {/* Prévia ao Vivo dos Blocos (Estilizado Idêntico à Foto) */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.dark }}>
                  Prévia Visual da Planilha ({mode === "semanal" ? "Semanal" : mode === "mensal" ? "Mensal" : "Diário"})
                </span>
              </div>

              {activeDates.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewDayIndex((idx) => Math.max(0, idx - 1))}
                    disabled={previewDayIndex === 0}
                    className="p-1 rounded-lg border bg-white disabled:opacity-30 hover:bg-gray-50 text-xs flex items-center gap-0.5"
                    style={{ borderColor: T.border }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                  <span className="text-xs font-semibold px-2" style={{ color: T.textSoft }}>
                    Dia {previewDayIndex + 1} de {activeDates.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewDayIndex((idx) => Math.min(activeDates.length - 1, idx + 1))}
                    disabled={previewDayIndex >= activeDates.length - 1}
                    className="p-1 rounded-lg border bg-white disabled:opacity-30 hover:bg-gray-50 text-xs flex items-center gap-0.5"
                    style={{ borderColor: T.border }}
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Container da Tabela com Estilo Fiel da Foto */}
            <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-inner max-w-2xl mx-auto font-mono text-xs">
              {/* Linha Amarela / Ouro do Dia */}
              <div
                className="py-2 px-4 text-center font-bold text-sm tracking-wider uppercase border-b-2 border-black"
                style={{ background: "#D8A92A", color: "#000000" }}
              >
                {previewSchedule.headerTitle}
              </div>

              {previewSchedule.blocks.length === 0 ? (
                <div className="py-8 text-center text-gray-500 font-sans text-xs">
                  Nenhum atendimento ou horário cadastrado para este dia ({formatDateBr(currentPreviewDate)}).
                </div>
              ) : (
                <div className="p-3 space-y-4 font-sans">
                  {previewSchedule.blocks.map((block, bIdx) => (
                    <div key={bIdx} className="border-2 border-black rounded-none overflow-hidden">
                      {/* Título do Terapeuta (Azul Turquesa) */}
                      <div
                        className="py-1.5 px-3 text-center font-bold text-xs uppercase border-b-2 border-black tracking-wide"
                        style={{ background: "#5FAFB9", color: "#000000" }}
                      >
                        {block.therapistName}
                      </div>

                      {/* Tabela de Horários */}
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr style={{ background: "#83C6CE" }}>
                            <th className="py-1 px-2.5 font-bold text-center border-r border-b border-black w-16 text-[11px]">
                              HORA
                            </th>
                            <th className="py-1 px-3 font-bold border-r border-b border-black text-[11px]">
                              ASSISTIDO
                            </th>
                            <th className="py-1 px-3 font-bold border-r border-b border-black w-36 text-[11px]">
                              FONE
                            </th>
                            <th className="py-1 px-2.5 font-bold border-b border-black w-24 text-center text-[11px]">
                              MODALIDADE
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-black last:border-b-0 hover:bg-black/5">
                              <td className="py-1 px-2.5 font-bold text-center border-r border-black text-[11px]">
                                {row.hora}
                              </td>
                              <td className="py-1 px-3 font-medium border-r border-black text-[11px] uppercase">
                                {row.assistido || <span className="text-gray-400 font-normal italic">— livre —</span>}
                              </td>
                              <td className="py-1 px-3 border-r border-black text-[11px]">
                                {row.fone}
                              </td>
                              <td className="py-1 px-2.5 font-semibold text-[10px] text-center">
                                {row.modalidade === "PRESENCIAL" ? (
                                  <span className="text-emerald-800 font-bold">PRESENCIAL</span>
                                ) : row.modalidade === "DISTANCIA" ? (
                                  <span className="text-sky-800 font-bold">DISTANCIA</span>
                                ) : (
                                  ""
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-gray-50 shrink-0" style={{ borderColor: T.border }}>
          <div className="text-xs text-gray-500 hidden sm:block">
            {mode === "semanal" ? (
              <span>Gera abas para cada dia da semana + aba geral consolidada.</span>
            ) : mode === "mensal" ? (
              <span>Gera aba com o mês consolidado + abas para cada dia com escala.</span>
            ) : (
              <span>Gera o arquivo para o dia {formatDateBr(referenceDate)}.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition"
              style={{ borderColor: T.border }}
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-sm hover:brightness-110 disabled:opacity-50"
              style={{ background: downloadSuccess ? "#1D6F42" : T.primary }}
            >
              {isExporting ? (
                <>Gerando Planilha...</>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" /> Planilha Baixada!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Baixar Planilha Excel (.xlsx)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
