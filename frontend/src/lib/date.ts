/**
 * Parsea una fecha solo-día (YYYY-MM-DD) como fecha local, sin cambio de zona.
 * Evita que "2026-03-08" se interprete como medianoche UTC y se muestre como 7 de marzo en Ecuador.
 */
export function parseLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(
  dateOnly: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  return parseLocalDate(dateOnly).toLocaleDateString('es-EC', options);
}
