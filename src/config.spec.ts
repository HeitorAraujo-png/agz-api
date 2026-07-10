import { describe, expect, it } from 'vitest'
import { parseUnavailableWeekdays } from './config.js'

describe('UNAVAILABLE_WEEKDAYS', () => {
  it('supports Monday, Tuesday and multiple weekdays', () => {
    expect(parseUnavailableWeekdays('1')).toEqual(new Set([1]))
    expect(parseUnavailableWeekdays('2')).toEqual(new Set([2]))
    expect(parseUnavailableWeekdays('1, 3,7')).toEqual(new Set([1, 3, 7]))
  })
  it('rejects invalid ISO weekdays', () =>
    expect(() => parseUnavailableWeekdays('0,8')).toThrow('dias ISO'))
})
