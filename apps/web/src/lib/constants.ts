// Tournament formats
export const TOURNAMENT_FORMATS = [
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination', description: "Lose once and you're out" },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination', description: 'Must lose twice to be eliminated' },
  { value: 'ROUND_ROBIN', label: 'Round Robin', description: 'Everyone plays everyone' },
  { value: 'SWISS', label: 'Swiss', description: 'Players with similar records face each other' },
] as const;

// Platforms
export const PLATFORMS = [
  { value: 'PS5', label: 'PlayStation 5' },
  { value: 'XBOX', label: 'Xbox Series X|S' },
  { value: 'PC', label: 'PC' },
  { value: 'CROSS_PLATFORM', label: 'Cross-Platform' },
] as const;

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

// Platform fees
export const PLATFORM_FEES = {
  FREE_TIER: 0.10,
  PRO_TIER: 0.05,
  ORGANIZER_TIER: 0.03,
} as const;
