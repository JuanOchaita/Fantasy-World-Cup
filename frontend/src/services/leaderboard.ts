import request from './api';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  squadName?: string;
  totalPoints: number;
  gameweekPoints?: number;
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
  getGlobal: async (page = 1, limit = 50): Promise<{ page: number; limit: number; items: LeaderboardEntry[] }> => {
    const res = await request<{
      page: number;
      limit: number;
      items: Array<{ rank: number; username: string; total_points: number }>;
    }>(`/leaderboard?page=${page}&limit=${limit}`);

    return {
      page: res.page,
      limit: res.limit,
      items: res.items.map(item => ({
        rank: item.rank,
        username: item.username,
        totalPoints: item.total_points,
      })),
    };
  },

  getAroundUser: () => request<MyRankResponse>('/leaderboard/me'),
};
