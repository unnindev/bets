import { format, toZonedTime } from 'date-fns-tz';
import { isToday, isTomorrow, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Detecta o timezone do navegador do usuário
 * Retorna o timezone IANA (ex: "America/Sao_Paulo", "Europe/Amsterdam")
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  // Fallback para servidor - usa UTC
  return 'UTC';
}

/**
 * Converte um timestamp Unix para Date no timezone do usuário
 */
export function timestampToUserDate(timestamp: number, timezone?: string): Date {
  const tz = timezone || getUserTimezone();
  const date = new Date(timestamp * 1000); // timestamp está em segundos
  return toZonedTime(date, tz);
}

/**
 * Formata a data de um jogo no timezone do usuário
 * Retorna no formato YYYY-MM-DD
 */
export function formatMatchDate(timestamp: number, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const date = new Date(timestamp * 1000);
  return format(toZonedTime(date, tz), 'yyyy-MM-dd', { timeZone: tz });
}

/**
 * Formata o horário de um jogo no timezone do usuário
 * Retorna no formato HH:mm
 */
export function formatMatchTime(timestamp: number, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const date = new Date(timestamp * 1000);
  return format(toZonedTime(date, tz), 'HH:mm', { timeZone: tz });
}

/**
 * Formata a data com texto amigável (Hoje, Amanhã, Ontem) ou data completa
 */
export function formatFriendlyDate(timestamp: number, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const zonedDate = toZonedTime(new Date(timestamp * 1000), tz);

  if (isToday(zonedDate)) return 'Hoje';
  if (isTomorrow(zonedDate)) return 'Amanhã';
  if (isYesterday(zonedDate)) return 'Ontem';

  return format(zonedDate, "EEE, dd 'de' MMM", { locale: ptBR });
}

/**
 * Formata data no padrão brasileiro DD/MM/YYYY
 */
export function formatDateBR(timestamp: number, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const date = new Date(timestamp * 1000);
  return format(toZonedTime(date, tz), 'dd/MM/yyyy', { timeZone: tz });
}

/**
 * Formata data curta DD/MM
 */
export function formatDateShort(timestamp: number, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const date = new Date(timestamp * 1000);
  return format(toZonedTime(date, tz), 'dd/MM', { timeZone: tz });
}

/**
 * Retorna o offset do timezone em formato legível
 * Ex: "GMT-3", "GMT+1"
 */
export function getTimezoneOffset(timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const now = new Date();
  const formatted = format(toZonedTime(now, tz), 'xxx', { timeZone: tz });
  // Converte "+01:00" para "GMT+1" ou "-03:00" para "GMT-3"
  const match = formatted.match(/([+-])(\d{2}):(\d{2})/);
  if (match) {
    const sign = match[1];
    const hours = parseInt(match[2], 10);
    const minutes = match[3];
    if (minutes === '00') {
      return `GMT${sign}${hours}`;
    }
    return `GMT${sign}${hours}:${minutes}`;
  }
  return 'GMT';
}

/**
 * Retorna nome amigável do timezone
 * Ex: "Europe/Amsterdam" -> "Horário de Amsterdã"
 */
export function getTimezoneName(timezone?: string): string {
  const tz = timezone || getUserTimezone();

  // Mapeamento de timezones comuns
  const timezoneNames: Record<string, string> = {
    'America/Sao_Paulo': 'Horário de Brasília',
    'America/Fortaleza': 'Horário de Fortaleza',
    'America/Manaus': 'Horário de Manaus',
    'America/Rio_Branco': 'Horário do Acre',
    'Europe/Amsterdam': 'Horário de Amsterdã',
    'Europe/London': 'Horário de Londres',
    'Europe/Paris': 'Horário de Paris',
    'Europe/Madrid': 'Horário de Madrid',
    'Europe/Berlin': 'Horário de Berlim',
    'Europe/Rome': 'Horário de Roma',
    'Europe/Lisbon': 'Horário de Lisboa',
    'America/New_York': 'Horário de Nova York',
    'America/Los_Angeles': 'Horário de Los Angeles',
    'UTC': 'UTC',
  };

  return timezoneNames[tz] || tz.replace(/_/g, ' ').split('/').pop() || tz;
}

/**
 * Converte uma string de data YYYY-MM-DD para timestamp às 12:00 no timezone
 * Útil para comparações de datas
 */
export function dateStringToTimestamp(dateStr: string, timezone?: string): number {
  const tz = timezone || getUserTimezone();
  const [year, month, day] = dateStr.split('-').map(Number);
  // Cria a data às 12:00 para evitar problemas de DST
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return Math.floor(date.getTime() / 1000);
}

/**
 * Retorna o timestamp atual em segundos
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Verifica se dois timestamps correspondem ao mesmo dia no timezone do usuário
 */
export function isSameDay(timestamp1: number, timestamp2: number, timezone?: string): boolean {
  return formatMatchDate(timestamp1, timezone) === formatMatchDate(timestamp2, timezone);
}
