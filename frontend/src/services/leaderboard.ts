import request from './api';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  squadName: string;
  totalPoints: number;
  gameweekPoints: number;
}

export interface MyRankResponse {
  username: string;
  squad_name: string;
  rank: number;
  score: number;
  game_wins: number;
  message?: string;
}

export const leaderboardService = {
  getGlobal: (page = 1, limit = 50) =>
    request<{ page: number; limit: number; items: LeaderboardEntry[] }>(`/leaderboard?page=${page}&limit=${limit}`),

  getAroundUser: () => request<MyRankResponse>('/leaderboard/me'),
};
