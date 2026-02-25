/**
 * Utilitários compartilhados para informações de data/hora local.
 * Usado por: check-time-based-automations, check-birthday-automations,
 *            check-seasonal-automations
 */

export interface LocalTimeInfo {
  dayName: string;
  dayOfWeek: number;
  hours: number;
  minutes: number;
  monthNum: number;
  dayNum: number;
  yearNum: number;
  date: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

/**
 * Retorna informações de data/hora locais para o fuso horário especificado.
 * Retorno unificado com todos os campos que as automações precisam.
 */
export function getLocalTimeInfo(now: Date, timeZone: string): LocalTimeInfo {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  const dayName = parts.find(p => p.type === 'weekday')?.value || '';
  const dayOfWeek = WEEKDAY_MAP[dayName] ?? now.getDay();
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const monthNum = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const dayNum = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  const yearNum = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const date = `${year}-${month}-${day}`;

  return { dayName, dayOfWeek, hours, minutes, monthNum, dayNum, yearNum, date };
}
