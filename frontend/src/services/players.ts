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
}

export const playerService = {
  search: (query: string, filters?: { position?: string; team?: string; minPrice?: number; maxPrice?: number }) =>
    request<{ players: Player[]; total: number }>(`/players/search?q=${encodeURIComponent(query)}${filters?.position ? `&position=${filters.position}` : ''}${filters?.team ? `&team=${encodeURIComponent(filters.team)}` : ''}`),

  getById: (id: string) =>
    request<Player>(`/players/${id}`),
};
