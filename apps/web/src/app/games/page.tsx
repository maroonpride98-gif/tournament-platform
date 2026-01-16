'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Gamepad2, Search, Trophy, Users, Monitor, Tv } from 'lucide-react';
import { gamesApi } from '@/lib/api';

interface Game {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  category: string;
  platform: string;
  _count?: {
    tournaments: number;
    teams: number;
  };
}

const categoryLabels: Record<string, string> = {
  SPORTS: 'Sports',
  FIGHTING: 'Fighting',
  SHOOTER: 'Shooter',
  BATTLE_ROYALE: 'Battle Royale',
  RACING: 'Racing',
  RPG: 'RPG',
  STRATEGY: 'Strategy',
  OTHER: 'Other',
};

const platformLabels: Record<string, string> = {
  PS5: 'PlayStation 5',
  XBOX: 'Xbox Series X|S',
  PC: 'PC',
  CROSS_PLATFORM: 'Cross-Platform',
};

const platformIcons: Record<string, React.ReactNode> = {
  PS5: <Tv className="w-4 h-4" />,
  XBOX: <Monitor className="w-4 h-4" />,
  PC: <Monitor className="w-4 h-4" />,
  CROSS_PLATFORM: <Gamepad2 className="w-4 h-4" />,
};

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');

  useEffect(() => {
    async function fetchGames() {
      setLoading(true);
      setError(null);
      try {
        const response = await gamesApi.getAll({
          category: selectedCategory || undefined,
          platform: selectedPlatform || undefined,
          search: searchQuery || undefined,
        });
        setGames(response.data || []);
      } catch (err) {
        setError('Failed to load games. Please try again later.');
        console.error('Failed to fetch games:', err);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchGames, 300);
    return () => clearTimeout(debounce);
  }, [selectedCategory, selectedPlatform, searchQuery]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      SPORTS: 'bg-green-500/20 text-green-300',
      FIGHTING: 'bg-red-500/20 text-red-300',
      SHOOTER: 'bg-orange-500/20 text-orange-300',
      BATTLE_ROYALE: 'bg-purple-500/20 text-purple-300',
      RACING: 'bg-blue-500/20 text-blue-300',
      RPG: 'bg-yellow-500/20 text-yellow-300',
      STRATEGY: 'bg-cyan-500/20 text-cyan-300',
      OTHER: 'bg-gray-500/20 text-gray-300',
    };
    return colors[category] || colors.OTHER;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Games</h1>
        <p className="text-dark-400">Browse our catalog of supported competitive games</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search games..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input md:w-48"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input md:w-48"
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
          >
            <option value="">All Platforms</option>
            {Object.entries(platformLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setSelectedCategory(selectedCategory)} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <Gamepad2 className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400">No games found</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="card hover:border-primary-500/50 transition-all group overflow-hidden"
            >
              {/* Game Cover */}
              <div className="aspect-[3/4] bg-dark-700 rounded-lg mb-4 overflow-hidden">
                {game.coverImage ? (
                  <img
                    src={game.coverImage}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="w-16 h-16 text-dark-500" />
                  </div>
                )}
              </div>

              {/* Game Info */}
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors mb-2">
                  {game.name}
                </h3>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`badge ${getCategoryColor(game.category)}`}>
                    {categoryLabels[game.category] || game.category}
                  </span>
                  <span className="badge bg-dark-600 text-dark-200 flex items-center gap-1">
                    {platformIcons[game.platform]}
                    {game.platform}
                  </span>
                </div>

                {game.description && (
                  <p className="text-dark-400 text-sm line-clamp-2 mb-3">
                    {game.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-dark-400">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>{game._count?.tournaments || 0} tournaments</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{game._count?.teams || 0} teams</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
