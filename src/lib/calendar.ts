import type { Event, Rental, Reservation } from '@prisma/client'
import { addDays, dateKey, isoWeekday, monthBounds } from './date.js'

export type CalendarStatus =
  | 'available'
  | 'partial'
  | 'full'
  | 'closed'
  | 'event'
  | 'rental'
  | 'past'
export function buildCalendar(
  year: number,
  month: number,
  unavailableWeekdays: Set<number>,
  data: {
    reservations: Pick<Reservation, 'date'>[]
    events: Pick<Event, 'date' | 'active'>[]
    rentals: Pick<Rental, 'startDate' | 'eventDate' | 'endDate' | 'active'>[]
  },
  today = new Date(),
): Array<{
  date: string
  day: number
  inCurrentMonth: boolean
  status: CalendarStatus
  reservations: number
}> {
  const { start } = monthBounds(year, month)
  const todayKey = dateKey(today)
  const counts = new Map<string, number>()
  data.reservations.forEach((item) =>
    counts.set(dateKey(item.date), (counts.get(dateKey(item.date)) ?? 0) + 1),
  )
  const events = new Set(
    data.events.filter((item) => item.active).map((item) => dateKey(item.date)),
  )
  const rentals = new Set(
    data.rentals
      .filter((item) => item.active)
      .flatMap((item) => [item.startDate, item.eventDate, item.endDate].map(dateKey)),
  )
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index),
      key = dateKey(date),
      reservations = counts.get(key) ?? 0
    let status: CalendarStatus = 'available'
    if (key < todayKey) status = 'past'
    else if (unavailableWeekdays.has(isoWeekday(date))) status = 'closed'
    else if (events.has(key)) status = 'event'
    else if (rentals.has(key)) status = 'rental'
    else if (reservations >= 5) status = 'full'
    else if (reservations > 0) status = 'partial'
    return {
      date: key,
      day: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === month - 1,
      status,
      reservations,
    }
  })
}
