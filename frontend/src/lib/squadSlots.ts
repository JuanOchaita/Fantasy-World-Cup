export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export const FORMATION_OPTIONS = ['4-3-3', '4-4-2', '3-5-2', '3-4-3', '5-3-2', '5-4-1'] as const;
export type Formation = (typeof FORMATION_OPTIONS)[number];

export interface FormationShape {
  DEF: number;
  MID: number;
  FWD: number;
}

export interface SlotLayout {
  slot: string;
  posLabel: Position;
  top: string;
  left: string;
}

const DEFAULT_SHAPE: FormationShape = { DEF: 4, MID: 3, FWD: 3 };

function parseFormation(formation: string): FormationShape {
  const m = formation.match(/^(\d)-(\d)-(\d)$/);
  if (!m) return DEFAULT_SHAPE;
  const DEF = Number(m[1]);
  const MID = Number(m[2]);
  const FWD = Number(m[3]);
  if (DEF + MID + FWD !== 10) return DEFAULT_SHAPE;
  return { DEF, MID, FWD };
}

function linePositions(count: number): string[] {
  if (count <= 1) return ['50%'];
  const pad = 18;
  const usable = 100 - pad * 2;
  const step = usable / (count - 1);
  return Array.from({ length: count }, (_, i) => `${pad + i * step}%`);
}

// Keep player circles aligned to the same horizontal field bounds
// used by the pitch markings (`left/right: 8%` in Squad page).
function toPitchAlignedLeft(rawPercent: string): string {
  const n = Number.parseFloat(rawPercent);
  if (Number.isNaN(n)) return rawPercent;
  const leftBound = 8;
  const width = 84;
  return `${leftBound + (n / 100) * width}%`;
}

export function getFormationShape(formation: string): FormationShape {
  return parseFormation(formation);
}

export function getFormationSlots(formation: string): string[] {
  const shape = parseFormation(formation);
  const slots: string[] = ['GK'];
  for (let i = 1; i <= shape.DEF; i += 1) slots.push(`D${i}`);
  for (let i = 1; i <= shape.MID; i += 1) slots.push(`M${i}`);
  for (let i = 1; i <= shape.FWD; i += 1) slots.push(`F${i}`);
  return slots;
}

export function getPitchLayout(formation: string): SlotLayout[] {
  const shape = parseFormation(formation);
  const layout: SlotLayout[] = [{ slot: 'GK', posLabel: 'GK', top: '88%', left: '50%' }];

  linePositions(shape.DEF).forEach((left, i) => {
    layout.push({ slot: `D${i + 1}`, posLabel: 'DEF', top: '68%', left: toPitchAlignedLeft(left) });
  });
  linePositions(shape.MID).forEach((left, i) => {
    layout.push({ slot: `M${i + 1}`, posLabel: 'MID', top: '46%', left: toPitchAlignedLeft(left) });
  });
  linePositions(shape.FWD).forEach((left, i) => {
    layout.push({ slot: `F${i + 1}`, posLabel: 'FWD', top: '22%', left: toPitchAlignedLeft(left) });
  });

  return layout;
}

export function countPlayersByPositionFromSlots(filledSlots: Iterable<string>): Record<Position, number> {
  const result: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of filledSlots) {
    if (!s) continue;
    if (s === 'GK') result.GK += 1;
    else if (s.startsWith('D')) result.DEF += 1;
    else if (s.startsWith('M')) result.MID += 1;
    else if (s.startsWith('F')) result.FWD += 1;
  }
  return result;
}

export function firstEmptySlotForPosition(
  formation: string,
  filledSlots: Iterable<string>,
  position: Position
): string | null {
  const filled = new Set(filledSlots);
  const slots = getFormationSlots(formation);
  const acceptedPrefix = position === 'GK' ? 'GK' : position === 'DEF' ? 'D' : position === 'MID' ? 'M' : 'F';

  for (const slot of slots) {
    if (position === 'GK') {
      if (slot === 'GK' && !filled.has(slot)) return slot;
      continue;
    }
    if (slot.startsWith(acceptedPrefix) && !filled.has(slot)) return slot;
  }
  return null;
}
