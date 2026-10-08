// Utilitários de fuso horário (Brasília / America/Sao_Paulo).
// O servidor (Vercel) roda em UTC, então `new Date(y, m, d, h, min)` criaria
// o horário em UTC, gerando deslocamento de -3h ao exibir no navegador.

export const BR_TIMEZONE = "America/Sao_Paulo";
const BR_OFFSET = "-03:00"; // Brasil sem horário de verão desde 2019

/** Cria um Date (instante correto) a partir de data "YYYY-MM-DD" e horário "HH:mm" no horário de Brasília. */
export function buildBrazilDate(data: string, horario: string): Date | null {
    const [year, month, day] = String(data).split("-").map(Number);
    const [hours, minutes] = String(horario).split(":").map(Number);
    if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) return null;

    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${BR_OFFSET}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

/** Converte um Date em { data: "YYYY-MM-DD", horario: "HH:mm" } no horário de Brasília. */
export function splitBrazilDate(date: Date): { data: string; horario: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: BR_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    return {
        data: `${get("year")}-${get("month")}-${get("day")}`,
        horario: `${get("hour")}:${get("minute")}`,
    };
}
