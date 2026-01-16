'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Calendar, Users, DollarSign, Search, Gamepad2, ChevronLeft, ChevronRight } from 'lucide-react';
import { tournamentsApi, gamesApi } from '@/lib/api';

interface Tournament {
  id: string;
  name: string;
  slug: string;
  game: {
    id: string;
    name: string;
    platform: string;
  };
  format: string;
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  _count?: {
    participants: number;
  };
  participants?: Array<any>;
  startDate: string;
  status: string;
}

interface Game {
  id: string;
  name: string;
  slug: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'badge-secondary',
  REGISTRATION_OPEN: 'badge-success',
  REGISTRATION_CLOSED: 'badge-warning',
  CHECK_IN: 'badge-warning',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-primary',
  CANCELLED: 'badge-danger',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION_OPEN: 'Registration Open',
  REGISTRATION_CLOSED: 'Registration Closed',
  CHECK_IN: 'Check-In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elim',
  DOUBLE_ELIMINATION: 'Double Elim',
  ROUND_ROBIN: 'Round Robin',
  SWISS: 'Swiss',
};

const platformLabels: Record<string, string> = {
  PS5: 'PS5',
  XBOX: 'Xbox',
  PC: 'PC',
  CROSS_PLATFORM: 'Cross-Platform',
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const pageSize = 10;

  useEffect(() => {
    async function fetchGames() {
      try {
        const response = await gamesApi.getAll();
        setGames(response.data || []);
      } catch (err) {
        console.error('Failed to fetch games:', err);
      }
    }
    fetchGames();
  }, []);

  useEffect(() => {
    async function fetchTournaments() {
      setLoading(true);
      setError(null);
      try {
        const response = await tournamentsApi.getAll({
          page,
          pageSize,
          gameId: selectedGame || undefined,
          status: selectedStatus || undefined,
          search: searchQuery || undefined,
        });
        const data = response.data;
        setTournaments(data.items || data || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError('Failed to load tournaments. Please try again later.');
        console.error('Failed to fetch tournaments:', err);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchTournaments, 300);
    return () => clearTimeout(debounce);
  }, [page, searchQuery, selectedGame, selectedStatus]);

  const getParticipantCount = (tournament: Tournament) => {
    return tournament._count?.participants || tournament.participants?.length || 0;
  };

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
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="input md:w-48"
            value={selectedGame}
            onChange={(e) => {
              setSelectedGame(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Games</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
          <select
            className="input md:w-48"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="REGISTRATION_OPEN">Registration Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            className="input md:w-48"
            value={selectedFormat}
            onChange={(e) => {
              setSelectedFormat(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Formats</option>
            <option value="SINGLE_ELIMINATION">Single Elimination</option>
            <option value="DOUBLE_ELIMINATION">Double Elimination</option>
            <option value="ROUND_ROBIN">Round Robin</option>
            <option value="SWISS">Swiss</option>
          </select>
        </div>
      </div>

      {/* Tournament List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setPage(page)} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400 mb-4">No tournaments found</p>
          <Link href="/tournaments/create" className="btn-primary">
            Create the first tournament
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.slug || tournament.id}`}
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
                    <span className={statusColors[tournament.status] || 'badge-primary'}>
                      {statusLabels[tournament.status] || tournament.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-dark-400 text-sm">
                    <span>{tournament.game?.name || 'Unknown Game'}</span>
                    <span className="text-dark-600">•</span>
                    <span>{platformLabels[tournament.game?.platform] || tournament.game?.platform}</span>
                    <span className="text-dark-600">•</span>
                    <span>{formatLabels[tournament.format] || tournament.format}</span>
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
                      {getParticipantCount(tournament)}/{tournament.maxParticipants}
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
      )}

      {/* Pagination */}
      {!loading && !error && tournaments.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="btn-outline px-4 py-2 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </button>
          <span className="text-dark-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="btn-outline px-4 py-2 disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
