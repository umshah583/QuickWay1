export const PARTNER_SERVICE_CAR_TYPES = [
  "Saloon",
  "4x4 (5 Seaters)",
  "4x4 (7 Seaters)",
  "Caravan",
  "Motorcycle or Bike",
  "Jet-ski/Small boat",
] as const;

export type PartnerServiceCarType = (typeof PARTNER_SERVICE_CAR_TYPES)[number];
