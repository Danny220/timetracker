import { isWeekend, format, parseISO } from 'date-fns';

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Returns a map of Italian public holidays for a given year.
 */
export function getItalianHolidays(year: number): Record<string, string> {
  const easter = getEasterSunday(year);

  // Easter Monday (Pasquetta) is the day after Easter
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const holidays: Record<string, string> = {
    [`${year}-01-01`]: "Capodanno",
    [`${year}-01-06`]: "Epifania",
    [`${year}-04-25`]: "Festa della Liberazione",
    [`${year}-05-01`]: "Festa dei Lavoratori",
    [`${year}-06-02`]: "Festa della Repubblica",
    [`${year}-08-15`]: "Ferragosto",
    [`${year}-11-01`]: "Tutti i Santi",
    [`${year}-12-08`]: "Immacolata Concezione",
    [`${year}-12-25`]: "Natale",
    [`${year}-12-26`]: "Santo Stefano",
    [format(easterMonday, 'yyyy-MM-dd')]: "Lunedì dell'Angelo (Pasquetta)"
  };

  return holidays;
}

/**
 * Checks if a date is a weekend or an Italian holiday.
 */
export function isNonWorkingDay(dateString: string): { isNonWorking: boolean; reason: string | null } {
  const date = parseISO(dateString);
  if (isWeekend(date)) return { isNonWorking: true, reason: 'Weekend' };

  const year = date.getFullYear();
  const holidays = getItalianHolidays(year);

  const formattedDate = format(date, 'yyyy-MM-dd');
  if (holidays[formattedDate]) {
    return { isNonWorking: true, reason: holidays[formattedDate] };
  }

  return { isNonWorking: false, reason: null };
}
