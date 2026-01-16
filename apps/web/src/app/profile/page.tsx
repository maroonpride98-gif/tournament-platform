'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Trophy,
  DollarSign,
  Gamepad2,
  Settings,
  History,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { usersApi, paymentsApi } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  bio?: string;
  psnId?: string;
  xboxGamertag?: string;
  tier: string;
  stats?: {
    wins: number;
    losses: number;
    tournamentsPlayed: number;
    tournamentsWon: number;
    totalEarnings: number;
  };
}

interface Transaction {
  id: string;
  type: 'ENTRY_FEE' | 'PRIZE_PAYOUT' | 'REFUND' | 'SUBSCRIPTION';
  amount: number;
  status: string;
  description?: string;
  createdAt: string;
  tournament?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    try {
      const [profileRes, transactionsRes] = await Promise.all([
        usersApi.getMe(),
        paymentsApi.getTransactions({ pageSize: 20 }),
      ]);
      setProfile(profileRes.data);
      setTransactions(transactionsRes.data.items);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const stats = profile.stats || {
    wins: 0,
    losses: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    totalEarnings: 0,
  };

  const winRate = stats.wins + stats.losses > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
    : '0';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <User className="w-12 h-12 text-white" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
              <span className={`badge ${
                profile.tier === 'ORGANIZER' ? 'badge-warning' :
                profile.tier === 'PRO' ? 'badge-primary' : ''
              }`}>
                {profile.tier}
              </span>
            </div>

            {profile.bio && (
              <p className="text-dark-300 mb-3">{profile.bio}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {profile.psnId && (
                <div className="flex items-center gap-2 text-dark-300">
                  <Gamepad2 className="w-4 h-4 text-blue-400" />
                  <span>PSN: {profile.psnId}</span>
                </div>
              )}
              {profile.xboxGamertag && (
                <div className="flex items-center gap-2 text-dark-300">
                  <Gamepad2 className="w-4 h-4 text-green-400" />
                  <span>Xbox: {profile.xboxGamertag}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/profile/settings" className="btn-outline">
              <Settings className="w-4 h-4 mr-2" />
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{stats.tournamentsWon}</div>
          <div className="text-dark-400 text-sm">Tournaments Won</div>
        </div>
        <div className="card text-center">
          <Gamepad2 className="w-8 h-8 text-primary-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{stats.tournamentsPlayed}</div>
          <div className="text-dark-400 text-sm">Tournaments Played</div>
        </div>
        <div className="card text-center">
          <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{winRate}%</div>
          <div className="text-dark-400 text-sm">Win Rate ({stats.wins}W - {stats.losses}L)</div>
        </div>
        <div className="card text-center">
          <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-400">${stats.totalEarnings.toFixed(2)}</div>
          <div className="text-dark-400 text-sm">Total Earnings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-800 text-dark-300 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-800 text-dark-300 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          Transactions
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
            <p className="text-dark-400">No recent activity.</p>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Upcoming Tournaments</h2>
            <p className="text-dark-400">No upcoming tournaments.</p>
            <Link href="/tournaments" className="btn-primary mt-4 inline-block">
              Browse Tournaments
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Transaction History</h2>
            <div className="text-dark-400 text-sm">
              Balance: <span className="text-green-400 font-medium">${stats.totalEarnings.toFixed(2)}</span>
            </div>
          </div>

          {transactions.length === 0 ? (
            <p className="text-dark-400 text-center py-8">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === 'PRIZE_PAYOUT' || tx.type === 'REFUND'
                        ? 'bg-green-500/10'
                        : 'bg-red-500/10'
                    }`}>
                      {tx.type === 'PRIZE_PAYOUT' || tx.type === 'REFUND' ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {tx.type === 'ENTRY_FEE' && 'Tournament Entry'}
                        {tx.type === 'PRIZE_PAYOUT' && 'Prize Payout'}
                        {tx.type === 'REFUND' && 'Refund'}
                        {tx.type === 'SUBSCRIPTION' && 'Subscription'}
                      </p>
                      <p className="text-dark-400 text-sm">
                        {tx.tournament ? (
                          <Link
                            href={`/tournaments/${tx.tournament.slug}`}
                            className="hover:text-primary-400"
                          >
                            {tx.tournament.name}
                          </Link>
                        ) : (
                          tx.description
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-dark-500 text-xs">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
