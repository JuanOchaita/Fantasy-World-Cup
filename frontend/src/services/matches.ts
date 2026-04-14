import request from './api';
import { leaderboardService } from './leaderboard';

export interface MatchContribution {
  player_id: number;
  player_name: string;
  points_earned: number;
}

export interface MatchHistoryItem {
  match_id: number;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
  points_earned: number;
  total_points_after_match: number;
  scored_at: string;
  contributions: MatchContribution[];
}

export interface MatchHistoryResponse {
  total_accumulated_points: number;
  matches: MatchHistoryItem[];
}

export const matchService = {
  getHistory: async (): Promise<MatchHistoryResponse> => {
    try {
      return await request<MatchHistoryResponse>('/matches/history');
    } catch (error) {
      // Backward-compatible fallback when backend route is not deployed yet.
      if (error instanceof Error && error.message.includes('404')) {
        try {
          const rank = await leaderboardService.getAroundUser();
          return {
            total_accumulated_points: rank.score ?? 0,
            matches: [],
          };
        } catch {
          return {
            total_accumulated_points: 0,
            matches: [],
          };
        }
      }
      throw error;
    }
  },
};
