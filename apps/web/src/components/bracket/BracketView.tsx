'use client';

import { useState } from 'react';
import { Trophy, User, Users } from 'lucide-react';

interface Participant {
  id: string;
  user?: {
    id: string;
    username: string;
    avatar?: string;
  } | null;
  team?: {
    id: string;
    name: string;
    tag: string;
    logo?: string;
  } | null;
}

interface Match {
  id: string;
  round: number;
  matchNumber: number;
  participant1Id?: string | null;
  participant2Id?: string | null;
  score1?: number | null;
  score2?: number | null;
  winnerId?: string | null;
  status: string;
  scheduledAt?: string | null;
}

interface BracketViewProps {
  matches: Match[];
  participants: Participant[];
  bracketType: 'SOLO' | 'TEAM';
  format: string;
  isOrganizer?: boolean;
  onScoreSubmit?: (matchId: string, score1: number, score2: number) => void;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-dark-600',
  READY: 'bg-yellow-500/20 border-yellow-500/50',
  IN_PROGRESS: 'bg-blue-500/20 border-blue-500/50',
  COMPLETED: 'bg-green-500/20 border-green-500/50',
  DISPUTED: 'bg-red-500/20 border-red-500/50',
};

export function BracketView({
  matches,
  participants,
  bracketType,
  format,
  isOrganizer,
  onScoreSubmit,
}: BracketViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  // Group matches by round
  const rounds = matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  const totalRounds = Object.keys(rounds).length;

  const getRoundName = (round: number) => {
    const roundsFromFinal = totalRounds - round + 1;
    switch (roundsFromFinal) {
      case 1:
        return 'Finals';
      case 2:
        return 'Semi-Finals';
      case 3:
        return 'Quarter-Finals';
      default:
        return `Round ${round}`;
    }
  };

  const getParticipantById = (id: string | null | undefined): Participant | undefined => {
    if (!id) return undefined;
    return participants.find(
      (p) => p.id === id || p.user?.id === id || p.team?.id === id
    );
  };

  const getParticipantName = (id: string | null | undefined): string => {
    const participant = getParticipantById(id);
    if (!participant) return 'TBD';
    if (bracketType === 'TEAM' && participant.team) {
      return participant.team.name;
    }
    return participant.user?.username || 'Unknown';
  };

  const handleScoreSubmit = () => {
    if (selectedMatch && onScoreSubmit) {
      onScoreSubmit(selectedMatch.id, parseInt(score1) || 0, parseInt(score2) || 0);
      setSelectedMatch(null);
      setScore1('');
      setScore2('');
    }
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {Object.entries(rounds)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([round, roundMatches]) => (
            <div key={round} className="flex flex-col">
              {/* Round Header */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {getRoundName(parseInt(round))}
                </h3>
                <p className="text-sm text-dark-400">
                  {roundMatches.length} match{roundMatches.length !== 1 ? 'es' : ''}
                </p>
              </div>

              {/* Matches */}
              <div
                className="flex flex-col justify-around flex-1 gap-4"
                style={{
                  minHeight: `${roundMatches.length * 100}px`,
                }}
              >
                {roundMatches
                  .sort((a, b) => a.matchNumber - b.matchNumber)
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      bracketType={bracketType}
                      getParticipantName={getParticipantName}
                      getParticipantById={getParticipantById}
                      isOrganizer={isOrganizer}
                      onSelect={() => {
                        if (isOrganizer && (match.status === 'READY' || match.status === 'IN_PROGRESS')) {
                          setSelectedMatch(match);
                        }
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}

        {/* Champion Display */}
        {totalRounds > 0 && (
          <div className="flex flex-col items-center justify-center">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-yellow-400">Champion</h3>
            </div>
            <div className="w-48 p-4 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg text-center">
              <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              {(() => {
                const finalMatch = rounds[totalRounds]?.[0];
                if (finalMatch?.winnerId) {
                  return (
                    <p className="text-white font-semibold">
                      {getParticipantName(finalMatch.winnerId)}
                    </p>
                  );
                }
                return <p className="text-dark-400">TBD</p>;
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Score Submit Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              Submit Score
            </h3>
            <p className="text-dark-400 text-sm mb-4">
              Match #{selectedMatch.matchNumber} - Round {selectedMatch.round}
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm text-dark-400 mb-1 block">
                    {getParticipantName(selectedMatch.participant1Id)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                    className="input text-center text-xl"
                    placeholder="0"
                  />
                </div>
                <span className="text-dark-400 text-xl font-bold">vs</span>
                <div className="flex-1">
                  <label className="text-sm text-dark-400 mb-1 block">
                    {getParticipantName(selectedMatch.participant2Id)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                    className="input text-center text-xl"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScoreSubmit}
                  className="btn-primary"
                >
                  Submit Score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MatchCardProps {
  match: Match;
  bracketType: 'SOLO' | 'TEAM';
  getParticipantName: (id: string | null | undefined) => string;
  getParticipantById: (id: string | null | undefined) => Participant | undefined;
  isOrganizer?: boolean;
  onSelect: () => void;
}

function MatchCard({
  match,
  bracketType,
  getParticipantName,
  getParticipantById,
  isOrganizer,
  onSelect,
}: MatchCardProps) {
  const participant1 = getParticipantById(match.participant1Id);
  const participant2 = getParticipantById(match.participant2Id);
  const isCompleted = match.status === 'COMPLETED';
  const isClickable = isOrganizer && (match.status === 'READY' || match.status === 'IN_PROGRESS');

  return (
    <div
      className={`w-56 border rounded-lg overflow-hidden ${statusColors[match.status] || 'bg-dark-800'} ${
        isClickable ? 'cursor-pointer hover:border-primary-500/50' : ''
      }`}
      onClick={isClickable ? onSelect : undefined}
    >
      {/* Match Header */}
      <div className="px-3 py-1 bg-dark-700/50 flex justify-between items-center">
        <span className="text-xs text-dark-400">Match #{match.matchNumber}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          match.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
          match.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
          match.status === 'READY' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-dark-600 text-dark-400'
        }`}>
          {match.status.replace('_', ' ')}
        </span>
      </div>

      {/* Participant 1 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b border-dark-700/50 ${
          isCompleted && match.winnerId === match.participant1Id
            ? 'bg-green-500/10'
            : ''
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center flex-shrink-0">
          {bracketType === 'TEAM' ? (
            <Users className="w-4 h-4 text-dark-400" />
          ) : (
            <User className="w-4 h-4 text-dark-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${
            isCompleted && match.winnerId === match.participant1Id
              ? 'text-green-400 font-semibold'
              : match.participant1Id
              ? 'text-white'
              : 'text-dark-500'
          }`}>
            {getParticipantName(match.participant1Id)}
          </p>
        </div>
        {isCompleted && (
          <span className={`text-lg font-bold ${
            match.winnerId === match.participant1Id ? 'text-green-400' : 'text-dark-400'
          }`}>
            {match.score1 ?? '-'}
          </span>
        )}
        {isCompleted && match.winnerId === match.participant1Id && (
          <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        )}
      </div>

      {/* Participant 2 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          isCompleted && match.winnerId === match.participant2Id
            ? 'bg-green-500/10'
            : ''
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center flex-shrink-0">
          {bracketType === 'TEAM' ? (
            <Users className="w-4 h-4 text-dark-400" />
          ) : (
            <User className="w-4 h-4 text-dark-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${
            isCompleted && match.winnerId === match.participant2Id
              ? 'text-green-400 font-semibold'
              : match.participant2Id
              ? 'text-white'
              : 'text-dark-500'
          }`}>
            {getParticipantName(match.participant2Id)}
          </p>
        </div>
        {isCompleted && (
          <span className={`text-lg font-bold ${
            match.winnerId === match.participant2Id ? 'text-green-400' : 'text-dark-400'
          }`}>
            {match.score2 ?? '-'}
          </span>
        )}
        {isCompleted && match.winnerId === match.participant2Id && (
          <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
