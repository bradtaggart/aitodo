import { describe, expect, it } from 'vitest'
import {
  deriveRecurrenceFields,
  isRecurrenceDate,
  nextRecurrenceDate,
  projectRecurrenceDates,
  validateRecurrenceConfig,
} from './recurrence-rules'

describe('recurrence rules', () => {
  it('validates recurrence configs with existing messages', () => {
    expect(() => validateRecurrenceConfig({ recurrence_type: 'never' }))
      .toThrow('recurrence_type must be daily|weekly|monthly|custom')
    expect(() => validateRecurrenceConfig({ recurrence_type: 'weekly', day_mask: 0 }))
      .toThrow('day_mask required and non-zero for weekly')
    expect(() => validateRecurrenceConfig({ recurrence_type: 'custom', interval_days: 0 }))
      .toThrow('interval_days required and >= 1 for custom')
  })

  it('derives stored template fields from config and task due date', () => {
    expect(deriveRecurrenceFields({ recurrence_type: 'monthly' }, '2026-04-15')).toEqual({
      recurrence_type: 'monthly',
      day_mask: null,
      interval_days: null,
      day_of_month: 15,
    })
    expect(deriveRecurrenceFields({ recurrence_type: 'weekly', day_mask: 2 }, '2026-04-15')).toMatchObject({
      day_mask: 2,
      day_of_month: null,
    })
  })

  it('calculates the next recurrence date', () => {
    expect(nextRecurrenceDate({
      recurrence_type: 'weekly',
      day_mask: 2,
      interval_days: null,
      day_of_month: null,
    }, '2026-04-28')).toBe('2026-05-04')
  })

  it('projects dates and checks date membership', () => {
    const custom = {
      recurrence_type: 'custom',
      day_mask: null,
      interval_days: 14,
      day_of_month: null,
    }

    expect(projectRecurrenceDates(custom, '2026-04-28', '2026-05-30')).toEqual([
      '2026-05-12',
      '2026-05-26',
    ])
    expect(isRecurrenceDate(custom, '2026-04-28', '2026-05-12')).toBe(true)
    expect(isRecurrenceDate(custom, '2026-04-28', '2026-05-13')).toBe(false)
  })
})
