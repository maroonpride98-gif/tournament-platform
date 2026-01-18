import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ROUND_NAMES } from 'shared';
import { PaymentsService } from '../payments/payments.service';

interface Participant {
  id: string;
  user?: { id: string; username: string } | null;
  team?: { id: string; name: string } | null;
  seed?: number | null;
}

interface MatchData {
  round: number;
  matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  status: 'PENDING' | 'READY';
  bracketPosition: any;
}

@Injectable()
export class BracketService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Generate a single elimination bracket
   */
  generateSingleElimination(participants: Participant[]) {
    // Shuffle participants for random seeding if not already seeded
    const seededParticipants = this.seedParticipants(participants);

    // Calculate bracket size (next power of 2)
    const bracketSize = this.getNextPowerOfTwo(seededParticipants.length);
    const totalRounds = Math.log2(bracketSize);

    const matches: MatchData[] = [];
    const bracketData: any = {
      type: 'SINGLE_ELIMINATION',
      rounds: [],
      totalRounds,
      participantCount: seededParticipants.length,
    };

    // Generate first round with byes
    const firstRoundMatches = bracketSize / 2;
    let participantIndex = 0;

    for (let matchNum = 1; matchNum <= firstRoundMatches; matchNum++) {
      const participant1 = seededParticipants[participantIndex++];
      const participant2 = participantIndex < seededParticipants.length
        ? seededParticipants[participantIndex++]
        : null;

      // If participant2 is null, it's a bye - participant1 advances automatically
      const isBye = !participant2;

      const match: MatchData = {
        round: 1,
        matchNumber: matchNum,
        participant1Id: this.getParticipantId(participant1),
        participant2Id: participant2 ? this.getParticipantId(participant2) : null,
        status: isBye ? 'PENDING' : 'READY', // Byes will be auto-advanced
        bracketPosition: {
          round: 1,
          position: matchNum,
          nextMatchNumber: Math.ceil(matchNum / 2),
          nextMatchPosition: matchNum % 2 === 1 ? 'participant1' : 'participant2',
        },
      };

      matches.push(match);
    }

    // Generate subsequent rounds (empty, to be filled as winners advance)
    let matchesInRound = firstRoundMatches / 2;
    let matchNumber = 1;

    for (let round = 2; round <= totalRounds; round++) {
      for (let i = 0; i < matchesInRound; i++) {
        const nextRound = round < totalRounds ? round + 1 : null;
        const nextMatchNum = nextRound ? Math.ceil((matchNumber) / 2) : null;

        matches.push({
          round,
          matchNumber,
          participant1Id: null,
          participant2Id: null,
          status: 'PENDING',
          bracketPosition: {
            round,
            position: matchNumber,
            nextMatchNumber: nextMatchNum,
            nextMatchPosition: matchNumber % 2 === 1 ? 'participant1' : 'participant2',
          },
        });

        matchNumber++;
      }

      matchNumber = 1;
      matchesInRound = matchesInRound / 2;
    }

    // Build bracket data for visualization
    bracketData.rounds = this.buildBracketRounds(matches, totalRounds);

    return { matches, bracketData };
  }

  /**
   * Seed participants (shuffle if no seeds assigned)
   */
  private seedParticipants(participants: Participant[]): Participant[] {
    const hasSeeds = participants.some((p) => p.seed != null);

    if (hasSeeds) {
      return [...participants].sort((a, b) => (a.seed || 999) - (b.seed || 999));
    }

    // Fisher-Yates shuffle for random seeding
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Get participant ID (user or team)
   */
  private getParticipantId(participant: Participant): string {
    return participant.user?.id || participant.team?.id || participant.id;
  }

  /**
   * Get next power of 2 that is >= n
   */
  private getNextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }

  /**
   * Build bracket rounds for visualization
   */
  private buildBracketRounds(matches: MatchData[], totalRounds: number) {
    const rounds: Array<{
      round: number;
      name: string;
      matches: Array<{
        matchNumber: number;
        participant1Id: string | null;
        participant2Id: string | null;
        status: string;
      }>;
    }> = [];

    for (let round = 1; round <= totalRounds; round++) {
      const roundMatches = matches.filter((m) => m.round === round);
      const roundName = ROUND_NAMES[totalRounds]?.[round] || `Round ${round}`;

      rounds.push({
        round,
        name: roundName,
        matches: roundMatches.map((m) => ({
          matchNumber: m.matchNumber,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          status: m.status,
        })),
      });
    }

    return rounds;
  }

  /**
   * Advance winner to the next round
   */
  async advanceWinner(matchId: string, winnerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match || !match.bracketPosition) {
      return;
    }

    const position = match.bracketPosition as any;

    // Determine the loser of this match
    const loserId = match.participant1Id === winnerId
      ? match.participant2Id
      : match.participant1Id;

    if (!position.nextMatchNumber) {
      // This was the finals - tournament is complete
      await this.prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: 'COMPLETED' },
      });

      // Update winner's participant record (1st place)
      await this.prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId: match.tournamentId,
          OR: [{ userId: winnerId }, { teamId: winnerId }],
        },
        data: { status: 'WINNER', placement: 1 },
      });

      // Update loser's participant record (2nd place)
      if (loserId) {
        await this.prisma.tournamentParticipant.updateMany({
          where: {
            tournamentId: match.tournamentId,
            OR: [{ userId: loserId }, { teamId: loserId }],
          },
          data: { status: 'ELIMINATED', placement: 2 },
        });
      }

      // Auto-distribute prizes
      try {
        await this.paymentsService.distributePrizes(match.tournamentId);
      } catch (error) {
        // Log error but don't fail the match completion
        // Prizes can be distributed manually via endpoint
      }

      return;
    }

    // Find the next match
    const nextMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId: match.tournamentId,
        round: match.round + 1,
        matchNumber: position.nextMatchNumber,
      },
    });

    if (!nextMatch) {
      return;
    }

    // Check if this is a semi-final (next match is the finals)
    const nextMatchPosition = nextMatch.bracketPosition as any;
    const isSemiFinal = nextMatchPosition && !nextMatchPosition.nextMatchNumber;

    // If semi-final, loser gets 3rd place
    if (isSemiFinal && loserId) {
      await this.prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId: match.tournamentId,
          OR: [{ userId: loserId }, { teamId: loserId }],
        },
        data: { status: 'ELIMINATED', placement: 3 },
      });
    }

    // Update the next match with the winner
    const updateField = position.nextMatchPosition === 'participant1'
      ? { participant1Id: winnerId }
      : { participant2Id: winnerId };

    const updatedNextMatch = await this.prisma.match.update({
      where: { id: nextMatch.id },
      data: updateField,
    });

    // Check if the next match is ready (both participants set)
    if (updatedNextMatch.participant1Id && updatedNextMatch.participant2Id) {
      await this.prisma.match.update({
        where: { id: nextMatch.id },
        data: { status: 'READY' },
      });
    }
  }

  /**
   * Handle bye matches (auto-advance)
   */
  async processFirstRoundByes(tournamentId: string) {
    const byeMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        round: 1,
        participant2Id: null,
        participant1Id: { not: null },
      },
    });

    for (const match of byeMatches) {
      // Auto-advance participant1 as winner
      await this.prisma.match.update({
        where: { id: match.id },
        data: {
          winnerId: match.participant1Id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await this.advanceWinner(match.id, match.participant1Id!);
    }
  }
}
