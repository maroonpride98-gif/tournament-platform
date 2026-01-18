'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  Gamepad2,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  User,
  Shield,
} from 'lucide-react';
import { tournamentsApi, paymentsApi, walletApi } from '@/lib/api';
import { TOURNAMENT_STATUS_LABELS, MATCH_STATUS_LABELS } from '@/lib/constants';
import { BracketView } from '@/components/bracket/BracketView';
import { useTournamentSocket } from '@/lib/socket';

interface Tournament {
  id: string;
  name: string;
  slug: string;
  description?: string;
  format: string;
  bracketType: string;
  teamSize: number;
  maxParticipants: number;
  entryFee: number;
  prizePool: number;
  rules?: string;
  startDate: string;
  registrationEnd?: string;
  status: string;
  game: {
    id: string;
    name: string;
    platform: string[];
  };
  createdBy: {
    id: string;
    username: string;
    avatar?: string;
  };
  participants: Array<{
    id: string;
    seed?: number;
    status: string;
    user?: {
      id: string;
      username: string;
      avatar?: string;
    };
    team?: {
      id: string;
      name: string;
      tag: string;
    };
  }>;
  matches: Array<{
    id: string;
    round: number;
    matchNumber: number;
    participant1Id?: string;
    participant2Id?: string;
    score1?: number;
    score2?: number;
    winnerId?: string;
    status: string;
    scheduledAt?: string;
  }>;
}

const formatLabels: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  ROUND_ROBIN: 'Round Robin',
  SWISS: 'Swiss',
};

export default function TournamentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // Real-time updates via Socket.io
  const { isConnected, lastUpdate } = useTournamentSocket(tournament?.id);

  const loadTournament = useCallback(async () => {
    try {
      const response = await tournamentsApi.getOne(params.id as string);
      setTournament(response.data);
    } catch (err) {
      setError('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadTournament();

    // Check payment status from URL
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setPaymentStatus('success');
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
    }
  }, [params.id, searchParams, loadTournament]);

  // Reload tournament when socket update received
  useEffect(() => {
    if (lastUpdate) {
      loadTournament();
    }
  }, [lastUpdate, loadTournament]);

  const isRegistered = tournament?.participants.some(
    (p) => p.user?.id === (session?.user as any)?.id
  );

  const isOrganizer = tournament?.createdBy.id === (session?.user as any)?.id;

  const handleRegister = async () => {
    if (!session) {
      window.location.href = '/auth/login';
      return;
    }

    setRegistering(true);
    setError('');

    try {
      if (tournament!.entryFee > 0) {
        // Check user's credit balance first
        const balanceResponse = await walletApi.getBalance();
        const balance = balanceResponse.data.balance;
        const creditsRequired = Math.round(tournament!.entryFee * 100);

        if (balance < creditsRequired) {
          // Not enough credits - redirect to wallet to buy more
          const creditsNeeded = creditsRequired - balance;
          window.location.href = `/wallet?needed=${creditsNeeded}&returnTo=${encodeURIComponent(`/tournaments/${tournament!.id}`)}`;
          return;
        }

        // Pay with credits
        await paymentsApi.payEntryFee(tournament!.id);
        setPaymentStatus('success');
        await loadTournament();
      } else {
        // Free tournament - register directly
        await tournamentsApi.register(tournament!.id);
        await loadTournament();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  const handleRefund = async () => {
    if (!confirm('Are you sure you want to withdraw and request a refund?')) {
      return;
    }

    setRegistering(true);
    try {
      await paymentsApi.refund(tournament!.id);
      await loadTournament();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Tournament Not Found</h1>
        <Link href="/tournaments" className="text-primary-400 hover:underline">
          Back to Tournaments
        </Link>
      </div>
    );
  }

  const spotsRemaining = tournament.maxParticipants - tournament.participants.length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Payment Status Banners */}
      {paymentStatus === 'success' && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-green-400 font-medium">Payment Successful!</p>
            <p className="text-green-400/80 text-sm">You are now registered for this tournament.</p>
          </div>
        </div>
      )}

      {paymentStatus === 'cancelled' && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
          <XCircle className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-yellow-400 font-medium">Payment Cancelled</p>
            <p className="text-yellow-400/80 text-sm">Your registration was not completed.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        {/* Main Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className={`badge ${
              tournament.status === 'REGISTRATION_OPEN' ? 'badge-success' :
              tournament.status === 'IN_PROGRESS' ? 'badge-warning' :
              tournament.status === 'COMPLETED' ? 'badge-primary' : 'badge-danger'
            }`}>
              {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
            </span>
            <span className="text-dark-400">{tournament.game.name}</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {tournament.name}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-dark-300 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-dark-500" />
              <span>{new Date(tournament.startDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-dark-500" />
              <span>{tournament.participants.length}/{tournament.maxParticipants} participants</span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-dark-500" />
              <span>{formatLabels[tournament.format]}</span>
            </div>
          </div>

          {tournament.description && (
            <p className="text-dark-300 mb-6">{tournament.description}</p>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-400">Organized by</p>
              <p className="text-white font-medium">{tournament.createdBy.username}</p>
            </div>
          </div>
        </div>

        {/* Registration Card */}
        <div className="lg:w-80">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-dark-400">Entry Fee</span>
              <span className="text-2xl font-bold text-white">
                {tournament.entryFee > 0 ? `$${tournament.entryFee}` : 'Free'}
              </span>
            </div>

            {tournament.entryFee > 0 && (
              <div className="mb-4 pb-4 border-b border-dark-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-dark-400">Current Prize Pool</span>
                  <span className="text-2xl font-bold text-green-400">
                    ${tournament.prizePool.toFixed(2)}
                  </span>
                </div>
                {tournament.participants.length < tournament.maxParticipants && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-500">Potential (if full)</span>
                    <span className="text-dark-400">
                      ${(tournament.entryFee * tournament.maxParticipants * 0.9).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Format</span>
                <span className="text-white">{formatLabels[tournament.format]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Type</span>
                <span className="text-white">
                  {tournament.bracketType === 'SOLO' ? '1v1 Solo' : `${tournament.teamSize}v${tournament.teamSize} Teams`}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Spots Left</span>
                <span className={`font-medium ${spotsRemaining <= 5 ? 'text-yellow-400' : 'text-white'}`}>
                  {spotsRemaining} / {tournament.maxParticipants}
                </span>
              </div>
            </div>

            {tournament.status === 'REGISTRATION_OPEN' && (
              <>
                {isRegistered ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400 justify-center py-3 bg-green-500/10 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">You&apos;re Registered</span>
                    </div>
                    {tournament.entryFee > 0 && (
                      <button
                        onClick={handleRefund}
                        disabled={registering}
                        className="btn-outline w-full text-sm"
                      >
                        {registering ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Withdraw & Refund'
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={registering || spotsRemaining === 0}
                    className="btn-primary w-full py-3"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : spotsRemaining === 0 ? (
                      'Tournament Full'
                    ) : tournament.entryFee > 0 ? (
                      <>
                        <DollarSign className="w-5 h-5 mr-1" />
                        Pay & Register - ${tournament.entryFee}
                      </>
                    ) : (
                      'Register Now'
                    )}
                  </button>
                )}
              </>
            )}

            {tournament.status === 'IN_PROGRESS' && (
              <div className="text-center py-3 bg-yellow-500/10 rounded-lg text-yellow-400">
                <Clock className="w-5 h-5 mx-auto mb-1" />
                Tournament in Progress
              </div>
            )}

            {tournament.status === 'COMPLETED' && (
              <div className="text-center py-3 bg-primary-500/10 rounded-lg text-primary-400">
                <Trophy className="w-5 h-5 mx-auto mb-1" />
                Tournament Completed
              </div>
            )}

            {isOrganizer && tournament.status === 'REGISTRATION_OPEN' && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-sm text-dark-400 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Organizer Actions
                </p>
                <Link
                  href={`/tournaments/${tournament.id}/manage`}
                  className="btn-outline w-full text-sm"
                >
                  Manage Tournament
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Participants */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">
              Participants ({tournament.participants.length})
            </h2>

            {tournament.participants.length === 0 ? (
              <p className="text-dark-400">No participants yet. Be the first to register!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tournament.participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg"
                  >
                    <span className="text-dark-500 w-6 text-center">{index + 1}</span>
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {participant.user?.username || participant.team?.name}
                      </p>
                      {participant.team && (
                        <p className="text-dark-400 text-sm">[{participant.team.tag}]</p>
                      )}
                    </div>
                    {participant.status === 'CHECKED_IN' && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bracket */}
          {tournament.matches.length > 0 && (
            <div className="card mt-6">
              <h2 className="text-xl font-semibold text-white mb-4">Bracket</h2>
              <BracketView
                matches={tournament.matches}
                participants={tournament.participants}
                bracketType={tournament.bracketType as 'SOLO' | 'TEAM'}
                format={tournament.format}
                isOrganizer={isOrganizer}
                onScoreSubmit={async (matchId, score1, score2) => {
                  try {
                    await tournamentsApi.reportScore(tournament.id, matchId, score1, score2);
                    await loadTournament();
                  } catch (err) {
                    console.error('Failed to submit score:', err);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Rules & Info */}
        <div>
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Rules</h2>
            {tournament.rules ? (
              <div className="text-dark-300 text-sm whitespace-pre-wrap">
                {tournament.rules}
              </div>
            ) : (
              <p className="text-dark-400">No specific rules provided.</p>
            )}
          </div>

          {tournament.entryFee > 0 && (
            <div className="card mt-6">
              <h2 className="text-xl font-semibold text-white mb-4">Prize Distribution</h2>
              {tournament.prizePool > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥇</span>
                      <span className="text-white">1st Place</span>
                    </div>
                    <span className="text-green-400 font-medium">
                      ${(tournament.prizePool * 0.6).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥈</span>
                      <span className="text-white">2nd Place</span>
                    </div>
                    <span className="text-green-400 font-medium">
                      ${(tournament.prizePool * 0.3).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥉</span>
                      <span className="text-white">3rd Place</span>
                    </div>
                    <span className="text-green-400 font-medium">
                      ${(tournament.prizePool * 0.1).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-dark-400 text-sm">
                  <p className="mb-2">Prize pool grows as participants register:</p>
                  <ul className="space-y-1 text-dark-500">
                    <li>🥇 1st Place: 60%</li>
                    <li>🥈 2nd Place: 30%</li>
                    <li>🥉 3rd Place: 10%</li>
                  </ul>
                  <p className="mt-3 text-dark-400">
                    Potential total: ${(tournament.entryFee * tournament.maxParticipants * 0.9).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
