// Platform fees
export const PLATFORM_FEES = {
  FREE_TIER: 0.10, // 10% for free users
  PRO_TIER: 0.05, // 5% for pro users
  ORGANIZER_TIER: 0.03, // 3% for organizer tier
} as const;

// Subscription prices (in USD)
export const SUBSCRIPTION_PRICES = {
  PRO: 9.99,
  ORGANIZER: 29.99,
} as const;

// Tournament limits
export const TOURNAMENT_LIMITS = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS_FREE: 32,
  MAX_PARTICIPANTS_PRO: 128,
  MAX_PARTICIPANTS_ORGANIZER: 512,
  MAX_ENTRY_FEE: 1000,
} as const;

// Bracket round names
export const ROUND_NAMES: Record<number, Record<number, string>> = {
  // For 8 player tournament (3 rounds)
  3: {
    1: 'Quarter Finals',
    2: 'Semi Finals',
    3: 'Finals',
  },
  // For 16 player tournament (4 rounds)
  4: {
    1: 'Round of 16',
    2: 'Quarter Finals',
    3: 'Semi Finals',
    4: 'Finals',
  },
  // For 32 player tournament (5 rounds)
  5: {
    1: 'Round of 32',
    2: 'Round of 16',
    3: 'Quarter Finals',
    4: 'Semi Finals',
    5: 'Finals',
  },
} as const;

// Game categories
export const GAME_CATEGORIES = [
  { value: 'SPORTS', label: 'Sports' },
  { value: 'FIGHTING', label: 'Fighting' },
  { value: 'SHOOTER', label: 'Shooter' },
  { value: 'BATTLE_ROYALE', label: 'Battle Royale' },
  { value: 'RACING', label: 'Racing' },
  { value: 'RPG', label: 'RPG' },
  { value: 'STRATEGY', label: 'Strategy' },
  { value: 'OTHER', label: 'Other' },
] as const;

// Platforms
export const PLATFORMS = [
  { value: 'PS5', label: 'PlayStation 5' },
  { value: 'XBOX', label: 'Xbox Series X|S' },
  { value: 'PC', label: 'PC' },
  { value: 'CROSS_PLATFORM', label: 'Cross-Platform' },
] as const;

// Tournament formats
export const TOURNAMENT_FORMATS = [
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination', description: 'Lose once and you\'re out' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination', description: 'Must lose twice to be eliminated' },
  { value: 'ROUND_ROBIN', label: 'Round Robin', description: 'Everyone plays everyone' },
  { value: 'SWISS', label: 'Swiss', description: 'Players with similar records face each other' },
] as const;

// Match statuses
export const MATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  READY: 'Ready to Play',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
};

// Tournament statuses
export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION_OPEN: 'Registration Open',
  REGISTRATION_CLOSED: 'Registration Closed',
  CHECK_IN: 'Check-in Active',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
