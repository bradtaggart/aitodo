import { nextRecurrenceDate, type RecurrenceSpec } from '../recurrence-rules'

export function advanceByRecurrence(spec: RecurrenceSpec, currentDue: string): string {
  return nextRecurrenceDate(spec, currentDue)
}

export type { RecurrenceSpec }
