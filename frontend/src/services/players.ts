import request from './api';

export interface Player {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  team: string;
  nationality: string;
  price: number;
  points: number;
  imageUrl?: string;
  /** Set when player comes from squad API (pitch slot key). */
  positionSlot?: string;
}

/** Single player from GET /players (with fantasy_price). */
export interface PlayerApiRow {
  player_id: number;
  short_name?: string | null;
  long_name?: string | null;
  player_positions?: string | null;
  nationality_name?: string | null;
  club_name?: string | null;
  fantasy_price: number;
}

export interface PlayersListResponse {
  count: number;
  results: PlayerApiRow[];
}

function mapPosition(posRaw: string): Player['position'] {
  const u = posRaw.toUpperCase();
  if (u.includes('GK')) return 'GK';
  if (/LB|RB|CB|LWB|RWB|DEF|DF/.test(u)) return 'DEF';
  if (/ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(u)) return 'FWD';
  return 'MID';
}

export function mapPlayerApiRow(p: PlayerApiRow): Player {
  const name = p.long_name?.trim() || p.short_name?.trim() || `Player #${p.player_id}`;
  const posStr = p.player_positions || '';
  return {
    id: String(p.player_id),
    name,
    position: mapPosition(posStr || 'MID'),
    team: p.nationality_name?.trim() || p.club_name?.trim() || '—',
    nationality: p.nationality_name?.trim() || '—',
    price: p.fantasy_price,
    points: 0,
    imageUrl: undefined,
  };
}

export const playerService = {
  /**
   * Lists players without name search (no `q` param) — server-side search is intentionally not used.
   */
  list: (limit = 50, offset = 0) =>
    request<PlayersListResponse>(`/players?limit=${limit}&offset=${offset}`),

  /**
   * Not connected to the backend (GET /players?q= is excluded).
   */
  search: (_query: string, _filters?: { position?: string; team?: string; minPrice?: number; maxPrice?: number }) =>
    Promise.reject(new Error('Server-side player search is not connected')),

  getById: (_id: string) => Promise.reject(new Error('GET /players/:id is not available on the API')),
};
