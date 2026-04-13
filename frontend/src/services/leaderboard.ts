import request from './api';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  squadName: string;
  totalPoints: number;
  gameweekPoints: number;
}

export const leaderboardService = {
  getGlobal: (page = 1, limit = 50) =>
    request<{ entries: LeaderboardEntry[]; total: number; page: number }>(`/leaderboard?page=${page}&limit=${limit}`),

  getAroundUser: () =>
    request<{ entries: LeaderboardEntry[]; userRank: number }>('/leaderboard/me'),
};
