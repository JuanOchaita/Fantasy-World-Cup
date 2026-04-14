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

function mapSquadPlayerRow(r: SquadPlayerRow): Player {
  const name = r.long_name?.trim() || r.short_name?.trim() || `Player #${r.player_id}`;
  const posRaw = (r.player_positions || r.club_name || 'MID').toUpperCase();
  let position: Player['position'] = 'MID';
  if (posRaw.includes('GK')) position = 'GK';
  else if (/LB|RB|CB|LWB|RWB|DEF|DF/.test(posRaw)) position = 'DEF';
  else if (/ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(posRaw)) position = 'FWD';

  return {
    id: String(r.player_id),
    name,
    position,
    team: r.nationality_name?.trim() || r.club_name?.trim() || '—',
    nationality: r.nationality_name?.trim() || '—',
    price: 0,
    points: 0,
    positionSlot: r.position_slot?.trim() || undefined,
  };
}

export function mapSquadDetails(res: SquadDetailsResponse): Squad {
  const spent = (res.squad.budget_used ?? 0) / 100;
  return {
    id: String(res.squad.squad_id),
    name: res.squad.squad_name,
    players: res.players.map(mapSquadPlayerRow),
    formation: res.squad.formation || '4-3-3',
    totalPoints: res.squad.total_points ?? 0,
    budget: BUDGET_CAP,
    budgetRemaining: Math.max(0, BUDGET_CAP - spent),
  };
}

export const squadService = {
  getDetails: () => request<SquadDetailsResponse>('/squad'),

  getMySquad: async (): Promise<Squad> => {
    const d = await squadService.getDetails();
    return mapSquadDetails(d);
  },

  initSquad: (data: { name: string; formation: string }) =>
    request<ApiSquadRow>('/squad', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
};
