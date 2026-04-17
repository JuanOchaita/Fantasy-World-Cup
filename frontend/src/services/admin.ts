import request from './api';

export interface SubmitMatchResultPayload {
  nation_a_id: number;
  nation_b_id: number;
  score_a: number;
  score_b: number;
}

export const adminService = {
  submitMatchResult: (payload: SubmitMatchResultPayload) =>
    request<{ message: string }>('/admin/results', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
