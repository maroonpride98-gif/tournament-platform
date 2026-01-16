import Link from 'next/link';
import { Trophy, Calendar, Users, DollarSign, Search, Filter, Gamepad2 } from 'lucide-react';

// Mock data - will be replaced with API calls
const tournaments = [
  {
    id: '1',
    name: 'FIFA 25 Championship',
    game: { name: 'EA Sports FC 25', platform: 'PS5' },
    format: 'SINGLE_ELIMINATION',
    entryFee: 10,
    prizePool: 500,
    maxParticipants: 32,
    currentParticipants: 24,
    startDate: '2025-02-15T18:00:00Z',
    status: 'REGISTRATION_OPEN',
  },
  {
    id: '2',
    name: 'Call of Duty Warzone Battle',
    game: { name: 'Call of Duty: Warzone', platform: 'CROSS_PLATFORM' },
    format: 'DOUBLE_ELIMINATION',
    entryFee: 25,
    prizePool: 1000,
    maxParticipants: 64,
    currentParticipants: 45,
    startDate: '2025-02-20T20:00:00Z',
    status: 'REGISTRATION_OPEN',
  },
  {
    id: '3',
    name: 'Tekken 8 Showdown',
    game: { name: 'Tekken 8', platform: 'PS5' },
    format: 'DOUBLE_ELIMINATION',
    entryFee: 15,
    prizePool: 300,
    maxParticipants: 16,
    currentParticipants: 16,
    startDate: '2025-02-10T19:00:00Z',
    status: 'IN_PROGRESS',
  },
  {
    id: '4',
    name: 'NBA 2K25 League',
    game: { name: 'NBA 2K25', platform: 'XBOX' },
    format: 'ROUND_ROBIN',
    entryFee: 0,
    prizePool: 0,
    maxParticipants: 8,
    currentParticipants: 6,
    startDate: '2025-02-25T17:00:00Z',
    status: 'REGISTRATION_OPEN',
  },
];

const statusColors: Record<string, string> = {
  REGISTRATION_OPEN: 'badge-success',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-primary',
};

const statusLabels: Record<string, string> = {
  REGISTRATION_OPEN: 'Registration Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elim',
  DOUBLE_ELIMINATION: 'Double Elim',
  ROUND_ROBIN: 'Round Robin',
  SWISS: 'Swiss',
};

export default function TournamentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Tournaments</h1>
          <p className="text-dark-400">Find and join competitive gaming tournaments</p>
        </div>
        <Link href="/tournaments/create" className="btn-primary">
          <Trophy className="w-4 h-4 mr-2" />
          Create Tournament
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search tournaments..."
              className="input pl-10"
            />
          </div>
          <select className="input md:w-48">
            <option value="">All Games</option>
            <option value="fifa">EA Sports FC 25</option>
            <option value="cod">Call of Duty</option>
            <option value="tekken">Tekken 8</option>
            <option value="nba">NBA 2K25</option>
          </select>
          <select className="input md:w-48">
            <option value="">All Platforms</option>
            <option value="ps5">PlayStation 5</option>
            <option value="xbox">Xbox</option>
            <option value="cross">Cross-Platform</option>
          </select>
          <select className="input md:w-48">
            <option value="">All Formats</option>
            <option value="single">Single Elimination</option>
            <option value="double">Double Elimination</option>
            <option value="robin">Round Robin</option>
          </select>
        </div>
      </div>

      {/* Tournament List */}
      <div className="grid gap-4">
        {tournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="card hover:border-primary-500/50 transition-all group"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Game Icon */}
              <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Gamepad2 className="w-8 h-8 text-primary-400" />
              </div>

              {/* Tournament Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold text-white group-hover:text-primary-400 transition-colors truncate">
                    {tournament.name}
                  </h3>
                  <span className={statusColors[tournament.status]}>
                    {statusLabels[tournament.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-dark-400 text-sm">
                  <span>{tournament.game.name}</span>
                  <span className="text-dark-600">•</span>
                  <span>{tournament.game.platform}</span>
                  <span className="text-dark-600">•</span>
                  <span>{formatLabels[tournament.format]}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap md:flex-nowrap gap-6 text-sm">
                <div className="flex items-center gap-2 text-dark-300">
                  <Calendar className="w-4 h-4 text-dark-500" />
                  <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-dark-300">
                  <Users className="w-4 h-4 text-dark-500" />
                  <span>
                    {tournament.currentParticipants}/{tournament.maxParticipants}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-dark-300">
                  <DollarSign className="w-4 h-4 text-dark-500" />
                  <span>
                    {tournament.entryFee > 0 ? `$${tournament.entryFee} entry` : 'Free'}
                  </span>
                </div>
                {tournament.prizePool > 0 && (
                  <div className="flex items-center gap-2 text-green-400 font-medium">
                    <Trophy className="w-4 h-4" />
                    <span>${tournament.prizePool}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-8">
        <div className="flex gap-2">
          <button className="btn-outline px-4 py-2" disabled>
            Previous
          </button>
          <button className="btn-primary px-4 py-2">1</button>
          <button className="btn-outline px-4 py-2">2</button>
          <button className="btn-outline px-4 py-2">3</button>
          <button className="btn-outline px-4 py-2">Next</button>
        </div>
      </div>
    </div>
  );
}
