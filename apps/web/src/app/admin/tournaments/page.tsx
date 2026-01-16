'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Search,
  Play,
  XCircle,
  Eye,
  Users,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Tournament {
  id: string;
  name: string;
  slug: string;
  status: string;
  startDate: string;
  format: string;
  maxParticipants: number;
  entryFee: number;
  prizePool: number;
  _count: {
    participants: number;
  };
  game: {
    name: string;
  };
  createdBy: {
    username: string;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300',
  REGISTRATION_OPEN: 'bg-green-500/20 text-green-300',
  REGISTRATION_CLOSED: 'bg-yellow-500/20 text-yellow-300',
  CHECK_IN: 'bg-blue-500/20 text-blue-300',
  IN_PROGRESS: 'bg-purple-500/20 text-purple-300',
  COMPLETED: 'bg-primary-500/20 text-primary-300',
  CANCELLED: 'bg-red-500/20 text-red-300',
};

export default function AdminTournamentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (authStatus === 'loading') return;

    const userRole = (session?.user as any)?.role;
    if (!session || userRole !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchTournaments();
  }, [session, authStatus, router, page, statusFilter]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/admin/tournaments?${params}`);
      setTournaments(response.data.items);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTournament = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to start this tournament? This will generate the bracket.')) {
      return;
    }

    setActionLoading(tournamentId);
    try {
      await api.post(`/tournaments/${tournamentId}/start`);
      await fetchTournaments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start tournament');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelTournament = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to cancel this tournament? This action cannot be undone.')) {
      return;
    }

    setActionLoading(tournamentId);
    try {
      await api.post(`/admin/tournaments/${tournamentId}/cancel`);
      await fetchTournaments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to cancel tournament');
    } finally {
      setActionLoading(null);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
            <Link href="/admin" className="hover:text-white">Admin</Link>
            <span>/</span>
            <span className="text-white">Tournaments</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Tournament Management</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search tournaments..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTournaments()}
            />
          </div>
          <select
            className="input md:w-48"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="REGISTRATION_OPEN">Registration Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Tournaments Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-4 px-4 text-dark-400 font-medium">Tournament</th>
                <th className="text-left py-4 px-4 text-dark-400 font-medium">Game</th>
                <th className="text-left py-4 px-4 text-dark-400 font-medium">Status</th>
                <th className="text-center py-4 px-4 text-dark-400 font-medium">Participants</th>
                <th className="text-right py-4 px-4 text-dark-400 font-medium">Prize Pool</th>
                <th className="text-right py-4 px-4 text-dark-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-dark-400">
                    No tournaments found
                  </td>
                </tr>
              ) : (
                tournaments.map((tournament) => (
                  <tr key={tournament.id} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-white">{tournament.name}</p>
                        <p className="text-sm text-dark-400">
                          by {tournament.createdBy.username}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-dark-300">{tournament.game.name}</td>
                    <td className="py-4 px-4">
                      <span className={`badge ${statusColors[tournament.status]}`}>
                        {tournament.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-dark-300">
                      {tournament._count.participants}/{tournament.maxParticipants}
                    </td>
                    <td className="py-4 px-4 text-right text-green-400 font-medium">
                      ${tournament.prizePool.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/tournaments/${tournament.slug}`}
                          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {tournament.status === 'REGISTRATION_OPEN' && (
                          <>
                            <button
                              onClick={() => handleStartTournament(tournament.id)}
                              disabled={actionLoading === tournament.id}
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                              title="Start Tournament"
                            >
                              {actionLoading === tournament.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelTournament(tournament.id)}
                              disabled={actionLoading === tournament.id}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                              title="Cancel Tournament"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
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
