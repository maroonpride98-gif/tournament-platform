'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Users,
  Gamepad2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Calendar,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api';

interface DashboardStats {
  totalUsers: number;
  totalTournaments: number;
  activeTournaments: number;
  totalPrizePool: number;
  totalGames: number;
  recentSignups: number;
}

interface RecentTournament {
  id: string;
  name: string;
  status: string;
  startDate: string;
  participantCount: number;
  prizePool: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTournaments, setRecentTournaments] = useState<RecentTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    // Check if user is admin
    const userRole = (session?.user as any)?.role;
    if (!session || userRole !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchDashboardData();
  }, [session, status, router]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, tournamentsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/tournaments/recent'),
      ]);
      setStats(statsRes.data);
      setRecentTournaments(tournamentsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      title: 'Active Tournaments',
      value: stats?.activeTournaments || 0,
      icon: Trophy,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Total Prize Pool',
      value: `$${(stats?.totalPrizePool || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
    {
      title: 'Games Available',
      value: stats?.totalGames || 0,
      icon: Gamepad2,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
  ];

  const statusColors: Record<string, string> = {
    REGISTRATION_OPEN: 'badge-success',
    IN_PROGRESS: 'badge-warning',
    COMPLETED: 'badge-primary',
    CANCELLED: 'badge-danger',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-dark-400">Manage your tournament platform</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/tournaments" className="btn-outline">
            <Trophy className="w-4 h-4 mr-2" />
            Tournaments
          </Link>
          <Link href="/admin/users" className="btn-outline">
            <Users className="w-4 h-4 mr-2" />
            Users
          </Link>
          <Link href="/admin/games" className="btn-primary">
            <Gamepad2 className="w-4 h-4 mr-2" />
            Games
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.title} className="card">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-dark-400 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Tournaments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Tournaments</h2>
            <Link href="/admin/tournaments" className="text-primary-400 text-sm hover:underline">
              View all
            </Link>
          </div>

          {recentTournaments.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tournaments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/admin/tournaments/${tournament.id}`}
                  className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{tournament.name}</p>
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <Calendar className="w-4 h-4" />
                      {new Date(tournament.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={statusColors[tournament.status] || 'badge-primary'}>
                      {tournament.status.replace('_', ' ')}
                    </span>
                    <p className="text-sm text-dark-400 mt-1">
                      {tournament.participantCount} players
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>

          <div className="space-y-3">
            <Link
              href="/admin/games/seed"
              className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Gamepad2 className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="font-medium text-white">Seed Games Database</p>
                <p className="text-sm text-dark-400">Add popular games to the platform</p>
              </div>
            </Link>

            <Link
              href="/admin/tournaments/pending"
              className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-white">Review Pending Tournaments</p>
                <p className="text-sm text-dark-400">Tournaments awaiting approval</p>
              </div>
            </Link>

            <Link
              href="/admin/analytics"
              className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-white">View Analytics</p>
                <p className="text-sm text-dark-400">Platform performance metrics</p>
              </div>
            </Link>

            <Link
              href="/admin/activity"
              className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">Activity Log</p>
                <p className="text-sm text-dark-400">Recent platform activity</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
