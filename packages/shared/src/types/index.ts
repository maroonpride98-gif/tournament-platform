// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  tier: string;
}

// Tournament types
export interface CreateTournamentDto {
  name: string;
  description?: string;
  gameId: string;
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
  bracketType: 'SOLO' | 'TEAM';
  teamSize: number;
  maxParticipants: number;
  entryFee: number;
  rules?: string;
  startDate: string;
  registrationEnd?: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  participant1?: ParticipantInfo;
  participant2?: ParticipantInfo;
  score1?: number;
  score2?: number;
  winnerId?: string;
  status: 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED';
  nextMatchId?: string;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  avatar?: string;
  seed?: number;
}

export interface BracketData {
  rounds: BracketRound[];
  totalRounds: number;
}

export interface BracketRound {
  round: number;
  name: string;
  matches: BracketMatch[];
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  wins: number;
  losses: number;
  tournamentsWon: number;
  earnings: number;
}
