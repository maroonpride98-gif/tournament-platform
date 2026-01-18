import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Cookies sent automatically
});

// Tournaments API
export const tournamentsApi = {
  getAll: (params?: {
    page?: number;
    pageSize?: number;
    gameId?: string;
    status?: string;
    search?: string;
  }) => api.get('/tournaments', { params }),

  getOne: (idOrSlug: string) => api.get(`/tournaments/${idOrSlug}`),

  create: (data: any) => api.post('/tournaments', data),

  register: (tournamentId: string, teamId?: string) =>
    api.post(`/tournaments/${tournamentId}/register`, { teamId }),

  start: (tournamentId: string) =>
    api.post(`/tournaments/${tournamentId}/start`),

  reportScore: (tournamentId: string, matchId: string, score1: number, score2: number) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/score`, {
      score1,
      score2,
    }),
};

// Payments API
export const paymentsApi = {
  payEntryFee: (tournamentId: string) =>
    api.post(`/payments/tournaments/${tournamentId}/pay`),

  getTransactions: (params?: { page?: number; pageSize?: number }) =>
    api.get('/payments/transactions', { params }),

  getTournamentTransactions: (tournamentId: string) =>
    api.get(`/payments/tournaments/${tournamentId}/transactions`),

  refund: (tournamentId: string, userId?: string) =>
    api.post(`/payments/tournaments/${tournamentId}/refund`, { userId }),
};

// Wallet API
export const walletApi = {
  getBalance: () => api.get('/wallet/balance'),

  getTransactions: (params?: { page?: number; pageSize?: number }) =>
    api.get('/wallet/transactions', { params }),

  getCreditPackages: () => api.get('/square/packages'),

  createCheckout: (packageId: string) =>
    api.post('/square/checkout', { packageId }),
};

// Games API
export const gamesApi = {
  getAll: (params?: { category?: string; platform?: string; search?: string }) =>
    api.get('/games', { params }),

  getOne: (idOrSlug: string) => api.get(`/games/${idOrSlug}`),
};

// Teams API
export const teamsApi = {
  getAll: (params?: { gameId?: string; search?: string }) =>
    api.get('/teams', { params }),

  getOne: (idOrTag: string) => api.get(`/teams/${idOrTag}`),

  create: (data: { name: string; tag: string; gameId: string; description?: string }) =>
    api.post('/teams', data),

  addMember: (teamId: string, userId: string) =>
    api.post(`/teams/${teamId}/members`, { userId }),

  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

// Users API
export const usersApi = {
  getMe: () => api.get('/users/me'),

  getByUsername: (username: string) => api.get(`/users/${username}`),

  updateProfile: (data: {
    bio?: string;
    avatar?: string;
    psnId?: string;
    xboxGamertag?: string;
  }) => api.patch('/users/me', data),

  getLeaderboard: (params?: { page?: number; pageSize?: number; gameId?: string }) =>
    api.get('/users/leaderboard', { params }),
};

// Auth API
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  refresh: () => api.post('/auth/refresh'),
};
