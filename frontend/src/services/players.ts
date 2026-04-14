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

export interface RedisPlayerSuggestion {
  id: number;
  name: string;
}

export interface ExternalSearchResult {
  player_id: number;
  long_name: string;
  nationality_name: string;
  club_name: string;
  player_positions: string;
  overall: number;
  value_eur: number;
}

export interface ExternalSearchResponse {
  pagination: {
    current_page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  query: string;
  results: ExternalSearchResult[];
  took_ms: number;
}

export interface ExternalPlayerDetail {
  player_id: number;
  long_name?: string;
  short_name?: string;
  nationality_name?: string;
  club_name?: string;
  player_positions?: string;
  overall?: number;
  value_eur?: number;
  player_face_url?: string;
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

type GoNullableString = { String?: string; Valid?: boolean } | string | null | undefined;
type GoNullableInt64 = { Int64?: number; Valid?: boolean } | number | null | undefined;

function readNullableString(value: GoNullableString): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && value.Valid && typeof value.String === 'string') {
    return value.String;
  }
  return null;
}

function readNullableNumber(value: GoNullableInt64): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && value.Valid && typeof value.Int64 === 'number') {
    return value.Int64;
  }
  return null;
}

function mapPosition(posRaw: string): Player['position'] {
  const u = posRaw.toUpperCase();
  if (u.includes('GK')) return 'GK';
  if (/LB|RB|CB|LWB|RWB|DEF|DF/.test(u)) return 'DEF';
  if (/ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(u)) return 'FWD';
  return 'MID';
}

export function mapPlayerApiRow(p: PlayerApiRow): Player {
  const name =
    readNullableString(p.long_name) ??
    readNullableString(p.short_name) ??
    `Player #${p.player_id}`;
  const posStr = readNullableString(p.player_positions) || '';
  return {
    id: String(p.player_id),
    name,
    position: mapPosition(posStr || 'MID'),
    team: readNullableString(p.nationality_name) ?? readNullableString(p.club_name) ?? '—',
    nationality: readNullableString(p.nationality_name) ?? '—',
    price: readNullableNumber(p.fantasy_price) ?? 0,
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

  suggestByName: async (key: string): Promise<RedisPlayerSuggestion[]> => {
    const url = `http://localhost:8081/redis?key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Suggestions HTTP ${res.status}`);
    return (await res.json()) as RedisPlayerSuggestion[];
  },

  searchAdvanced: async (params: {
    q: string;
    page: number;
    size?: number;
    nationality?: string;
    position?: string;
    club?: string;
    min_overall?: number;
    max_overall?: number;
  }): Promise<ExternalSearchResponse> => {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    qs.set('page', String(params.page));
    qs.set('size', String(params.size ?? 50));
    if (params.nationality) qs.set('nationality', params.nationality);
    if (params.position) qs.set('position', params.position);
    if (params.club) qs.set('club', params.club);
    if (typeof params.min_overall === 'number') qs.set('min_overall', String(params.min_overall));
    if (typeof params.max_overall === 'number') qs.set('max_overall', String(params.max_overall));

    const res = await fetch(`http://localhost:8083/search/players?${qs.toString()}`);
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    return (await res.json()) as ExternalSearchResponse;
  },

  getDetailById: async (playerId: number): Promise<ExternalPlayerDetail> => {
    const res = await fetch(`http://localhost:8082/player?name=${encodeURIComponent(String(playerId))}`);
    if (!res.ok) throw new Error(`Player detail HTTP ${res.status}`);
    return (await res.json()) as ExternalPlayerDetail;
  },
};
