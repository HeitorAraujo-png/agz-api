export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}
export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}
export function isoWeekday(value: Date): number {
  return value.getUTCDay() || 7
}
export function addDays(value: Date, days: number): Date {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
export function monthBounds(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = addDays(first, -(isoWeekday(first) - 1))
  return { start, end: addDays(start, 41) }
}
