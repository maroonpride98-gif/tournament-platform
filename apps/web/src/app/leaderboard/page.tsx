'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Medal, TrendingUp, DollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { usersApi, gamesApi } from '@/lib/api';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  wins: number;
  losses: number;
  tournamentsWon: number;
  earnings: number;
}

interface Game {
  id: string;
  name: string;
  slug: string;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const pageSize = 20;

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
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);
      try {
        const response = await usersApi.getLeaderboard({
          page,
          pageSize,
          gameId: selectedGame || undefined,
        });
        const data = response.data;
        setEntries(data.items || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError('Failed to load leaderboard. Please try again later.');
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [page, selectedGame]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-dark-400 font-mono">#{rank}</span>;
    }
  };

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-dark-400">Top players ranked by performance and earnings</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search players..."
              className="input pl-10"
            />
          </div>
          <select
            className="input md:w-64"
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
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setPage(page)}
              className="btn-primary mt-4"
            >
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400">No players found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-4 px-4 text-dark-400 font-medium w-20">Rank</th>
                  <th className="text-left py-4 px-4 text-dark-400 font-medium">Player</th>
                  <th className="text-center py-4 px-4 text-dark-400 font-medium">W/L</th>
                  <th className="text-center py-4 px-4 text-dark-400 font-medium">Win Rate</th>
                  <th className="text-center py-4 px-4 text-dark-400 font-medium">Tournaments Won</th>
                  <th className="text-right py-4 px-4 text-dark-400 font-medium">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.userId}
                    className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors ${
                      entry.rank <= 3 ? 'bg-dark-700/20' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center w-10">
                        {getRankIcon(entry.rank)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Link
                        href={`/profile/${entry.username}`}
                        className="flex items-center gap-3 hover:text-primary-400 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                          {entry.avatar ? (
                            <img
                              src={entry.avatar}
                              alt={entry.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            entry.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-white">{entry.username}</span>
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-green-400">{entry.wins}</span>
                      <span className="text-dark-500"> / </span>
                      <span className="text-red-400">{entry.losses}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4 text-dark-500" />
                        <span className="text-white">{getWinRate(entry.wins, entry.losses)}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-white">{entry.tournamentsWon}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 text-green-400 font-medium">
                        <DollarSign className="w-4 h-4" />
                        {entry.earnings.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && entries.length > 0 && (
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
