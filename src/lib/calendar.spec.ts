import { describe, expect, it } from 'vitest'
import { buildCalendar } from './calendar.js'

describe('calendar availability', () => {
  const data = { reservations: [], events: [], rentals: [] }
  it('uses configured weekdays instead of hardcoding Tuesday', () => {
    const monday = buildCalendar(
      2026,
      7,
      new Set([1]),
      data,
      new Date('2026-07-01T00:00:00Z'),
    ).find((day) => day.date === '2026-07-06')
    const tuesday = buildCalendar(
      2026,
      7,
      new Set([1]),
      data,
      new Date('2026-07-01T00:00:00Z'),
    ).find((day) => day.date === '2026-07-07')
    expect(monday?.status).toBe('closed')
    expect(tuesday?.status).toBe('available')
  })
})
