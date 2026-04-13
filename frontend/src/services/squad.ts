import request from './api';
import type { Player } from './players';

export interface Squad {
  id: string;
  name: string;
  players: Player[];
  formation: string;
  totalPoints: number;
  budget: number;
  budgetRemaining: number;
}

export const squadService = {
  getMySquad: () =>
    request<Squad>('/squad'),

  updateSquad: (data: { players: string[]; formation: string; name: string }) =>
    request<Squad>('/squad', { method: 'PUT', body: JSON.stringify(data) }),

  addPlayer: (playerId: string) =>
    request<Squad>(`/squad/players/${playerId}`, { method: 'POST' }),

  removePlayer: (playerId: string) =>
    request<Squad>(`/squad/players/${playerId}`, { method: 'DELETE' }),
};
