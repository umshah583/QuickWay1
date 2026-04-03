export const BREAK_REASON_SCHEMA = {
  LUNCH: "Lunch Break",
  REST: "Rest Break",
  PERSONAL: "Personal Break",
  EMERGENCY: "Emergency",
  OTHER: "Other"
} as const;

export type BreakReason = keyof typeof BREAK_REASON_SCHEMA;

export interface BreakRequest {
  reason: BreakReason;
  notes?: string;
}
