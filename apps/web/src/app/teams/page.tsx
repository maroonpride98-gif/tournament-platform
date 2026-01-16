'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Users, Search, Plus, Gamepad2, Trophy, UserPlus } from 'lucide-react';
import { teamsApi, gamesApi } from '@/lib/api';

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
}

interface Team {
  id: string;
  name: string;
  tag: string;
  description?: string;
  logo?: string;
  game: {
    id: string;
    name: string;
    slug: string;
  };
  members: TeamMember[];
  _count?: {
    members: number;
  };
  createdAt: string;
}

interface Game {
  id: string;
  name: string;
  slug: string;
}

export default function TeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    async function fetchTeams() {
      setLoading(true);
      setError(null);
      try {
        const response = await teamsApi.getAll({
          gameId: selectedGame || undefined,
          search: searchQuery || undefined,
        });
        setTeams(response.data || []);
      } catch (err) {
        setError('Failed to load teams. Please try again later.');
        console.error('Failed to fetch teams:', err);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchTeams, 300);
    return () => clearTimeout(debounce);
  }, [selectedGame, searchQuery]);

  const getMemberCount = (team: Team) => {
    return team._count?.members || team.members?.length || 0;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Teams</h1>
          <p className="text-dark-400">Find and join competitive gaming teams</p>
        </div>
        {session && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Team
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search teams by name or tag..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input md:w-64"
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
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

      {/* Teams Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setSelectedGame(selectedGame)} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400 mb-4">No teams found</p>
          {session && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create the first team
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.tag}`}
              className="card hover:border-primary-500/50 transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Team Logo */}
                <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <Users className="w-8 h-8 text-primary-400" />
                  )}
                </div>

                {/* Team Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors truncate">
                      {team.name}
                    </h3>
                    <span className="badge-primary">[{team.tag}]</span>
                  </div>
                  <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
                    <Gamepad2 className="w-4 h-4" />
                    <span>{team.game?.name || 'Unknown Game'}</span>
                  </div>
                  {team.description && (
                    <p className="text-dark-400 text-sm line-clamp-2">
                      {team.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Team Stats */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-dark-700">
                <div className="flex items-center gap-2 text-dark-300 text-sm">
                  <Users className="w-4 h-4 text-dark-500" />
                  <span>{getMemberCount(team)} members</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          games={games}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newTeam) => {
            setTeams([newTeam, ...teams]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  games,
  onClose,
  onSuccess,
}: {
  games: Game[];
  onClose: () => void;
  onSuccess: (team: Team) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    gameId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await teamsApi.create(formData);
      onSuccess(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h2 className="text-xl font-bold text-white mb-4">Create Team</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input
              type="text"
              className="input"
              placeholder="Enter team name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Team Tag (2-6 characters)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., TSM, FaZe"
              maxLength={6}
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div>
            <label className="label">Game</label>
            <select
              className="input"
              value={formData.gameId}
              onChange={(e) => setFormData({ ...formData, gameId: e.target.value })}
              required
            >
              <option value="">Select a game</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="Tell us about your team..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
