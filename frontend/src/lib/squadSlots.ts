/** Slot keys must match what we send to POST /squad/players and what the API returns in position_slot. */
export const SLOT_ORDER_433 = ['GK', 'D1', 'D2', 'D3', 'D4', 'M1', 'M2', 'M3', 'F1', 'F2', 'F3'] as const;

export type SlotKey = (typeof SLOT_ORDER_433)[number];

export function firstEmptySlot(filledSlots: Iterable<string>): string | null {
  const set = new Set(filledSlots);
  for (const s of SLOT_ORDER_433) {
    if (!set.has(s)) return s;
  }
  return null;
}

export const pitchLayout433: {
  slot: SlotKey;
  posLabel: string;
  top: string;
  left: string;
}[] = [
  { slot: 'GK', posLabel: 'GK', top: '82%', left: '50%' },
  { slot: 'D1', posLabel: 'DEF', top: '62%', left: '15%' },
  { slot: 'D2', posLabel: 'DEF', top: '62%', left: '38%' },
  { slot: 'D3', posLabel: 'DEF', top: '62%', left: '62%' },
  { slot: 'D4', posLabel: 'DEF', top: '62%', left: '85%' },
  { slot: 'M1', posLabel: 'MID', top: '38%', left: '25%' },
  { slot: 'M2', posLabel: 'MID', top: '38%', left: '50%' },
  { slot: 'M3', posLabel: 'MID', top: '38%', left: '75%' },
  { slot: 'F1', posLabel: 'FWD', top: '15%', left: '25%' },
  { slot: 'F2', posLabel: 'FWD', top: '15%', left: '50%' },
  { slot: 'F3', posLabel: 'FWD', top: '15%', left: '75%' },
];
