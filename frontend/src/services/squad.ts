import request from './api';
import type { Player } from './players';

/** Raw squad row from API */
export interface ApiSquadRow {
  squad_id: number;
  user_id: number;
  squad_name: string;
  formation: string | null;
  budget_used: number | null;
  total_points: number | null;
}

export interface SquadPlayerRow {
  player_id: number;
  short_name?: string | null;
  long_name?: string | null;
  player_positions?: string | null;
  nationality_name?: string | null;
  club_name?: string | null;
  position_slot?: string | null;
  value_eur?: number | null;
}

export interface SquadDetailsResponse {
  squad: ApiSquadRow;
  players: SquadPlayerRow[];
}

export interface Squad {
  id: string;
  name: string;
  players: Player[];
  formation: string;
  totalPoints: number;
  budget: number;
  budgetRemaining: number;
}

const BUDGET_CAP = 100;

type GoNullableString = { String?: string; Valid?: boolean } | string | null | undefined;
type GoNullableInt32 = { Int32?: number; Valid?: boolean } | number | null | undefined;
type GoNullableInt64 = { Int64?: number; Valid?: boolean } | number | null | undefined;

function readNullableString(value: GoNullableString): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && value.Valid && typeof value.String === 'string') {
    return value.String;
  }
  return null;
}

function readNullableNumber(value: GoNullableInt32 | GoNullableInt64): number | null {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object' || !value.Valid) return null;
  if ('Int64' in value && typeof value.Int64 === 'number') return value.Int64;
  if ('Int32' in value && typeof value.Int32 === 'number') return value.Int32;
  return null;
}

function mapSquadPlayerRow(r: SquadPlayerRow): Player {
  const name =
    readNullableString(r.long_name) ??
    readNullableString(r.short_name) ??
    `Player #${r.player_id}`;
  const posRaw = (
    readNullableString(r.player_positions) ??
    readNullableString(r.club_name) ??
    'MID'
  ).toUpperCase();
  let position: Player['position'] = 'MID';
  if (posRaw.includes('GK')) position = 'GK';
  else if (/LB|RB|CB|LWB|RWB|DEF|DF/.test(posRaw)) position = 'DEF';
  else if (/ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(posRaw)) position = 'FWD';

  return {
    id: String(r.player_id),
    name,
    position,
    team: readNullableString(r.nationality_name) ?? readNullableString(r.club_name) ?? '—',
    nationality: readNullableString(r.nationality_name) ?? '—',
    price: 0,
    points: 0,
    positionSlot: readNullableString(r.position_slot) ?? undefined,
  };
}

export function mapSquadDetails(res: SquadDetailsResponse): Squad {
  const spent = (readNullableNumber(res.squad.budget_used) ?? 0) / 100;
  const players = Array.isArray(res.players) ? res.players : [];
  return {
    id: String(res.squad.squad_id),
    name: res.squad.squad_name,
    players: players.map(mapSquadPlayerRow),
    formation: readNullableString(res.squad.formation) ?? '4-3-3',
    totalPoints: readNullableNumber(res.squad.total_points) ?? 0,
    budget: BUDGET_CAP,
    budgetRemaining: Math.max(0, BUDGET_CAP - spent),
  };
}

export const squadService = {
  getDetails: () => request<SquadDetailsResponse>('/squad'),

  ensureSquad: (data: { name: string; formation: string }) =>
    request<ApiSquadRow>('/squad', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMySquad: async (): Promise<Squad> => {
    const d = await squadService.getDetails();
    return mapSquadDetails(d);
  },

  initSquad: (data: { name: string; formation: string }) =>
    squadService.ensureSquad(data),

  addPlayer: (playerId: number, slot: string) =>
    request<{ message: string }>('/squad/players', {
      method: 'POST',
      body: JSON.stringify({ player_id: playerId, slot }),
    }),

  changeFormation: (formation: string) =>
    request<ApiSquadRow>('/squad/formation', {
      method: 'PATCH',
      body: JSON.stringify({ formation }),
    }),

  updateProfile: (data: { name: string; formation: string }) =>
    request<ApiSquadRow>('/squad', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
