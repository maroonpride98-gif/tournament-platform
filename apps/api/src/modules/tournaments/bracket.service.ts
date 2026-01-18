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

type BracketType = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS';

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
   * Generate a double elimination bracket
   * Winners bracket + Losers bracket + Grand Finals
   */
  generateDoubleElimination(participants: Participant[]) {
    const seededParticipants = this.seedParticipants(participants);
    const bracketSize = this.getNextPowerOfTwo(seededParticipants.length);
    const winnersRounds = Math.log2(bracketSize);

    const matches: MatchData[] = [];
    let globalMatchNumber = 1;

    // ===== WINNERS BRACKET =====
    const winnersFirstRoundMatches = bracketSize / 2;
    let participantIndex = 0;

    // Winners Round 1
    for (let matchNum = 1; matchNum <= winnersFirstRoundMatches; matchNum++) {
      const participant1 = seededParticipants[participantIndex++];
      const participant2 = participantIndex < seededParticipants.length
        ? seededParticipants[participantIndex++]
        : null;

      const isBye = !participant2;

      matches.push({
        round: 1,
        matchNumber: globalMatchNumber++,
        participant1Id: this.getParticipantId(participant1),
        participant2Id: participant2 ? this.getParticipantId(participant2) : null,
        status: isBye ? 'PENDING' : 'READY',
        bracketPosition: {
          bracket: 'WINNERS' as BracketType,
          winnersRound: 1,
          position: matchNum,
          // Winner goes to next winners round
          nextWinnersMatch: matchNum <= winnersFirstRoundMatches / 2 ? Math.ceil(matchNum / 2) : null,
          nextWinnersPosition: matchNum % 2 === 1 ? 'participant1' : 'participant2',
          // Loser goes to losers bracket round 1
          losersRound: 1,
          losersPosition: matchNum,
        },
      });
    }

    // Winners Rounds 2 to Finals
    let matchesInRound = winnersFirstRoundMatches / 2;
    for (let round = 2; round <= winnersRounds; round++) {
      for (let pos = 1; pos <= matchesInRound; pos++) {
        const isWinnersFinal = round === winnersRounds;

        matches.push({
          round: round,
          matchNumber: globalMatchNumber++,
          participant1Id: null,
          participant2Id: null,
          status: 'PENDING',
          bracketPosition: {
            bracket: 'WINNERS' as BracketType,
            winnersRound: round,
            position: pos,
            nextWinnersMatch: isWinnersFinal ? null : Math.ceil(pos / 2),
            nextWinnersPosition: pos % 2 === 1 ? 'participant1' : 'participant2',
            // Loser goes to losers bracket (specific round depends on winners round)
            losersRound: round,
            losersPosition: pos,
            isWinnersFinal,
          },
        });
      }
      matchesInRound = matchesInRound / 2;
    }

    // ===== LOSERS BRACKET =====
    // Losers bracket has (2 * winnersRounds - 2) rounds
    const losersRounds = 2 * winnersRounds - 2;

    // Calculate losers bracket matches
    let losersMatchesInRound = winnersFirstRoundMatches / 2;

    for (let lRound = 1; lRound <= losersRounds; lRound++) {
      // Odd rounds: receive losers from winners bracket
      // Even rounds: internal losers bracket matches (half the participants)
      const isReceivingRound = lRound % 2 === 1;

      if (!isReceivingRound && lRound > 1) {
        losersMatchesInRound = losersMatchesInRound / 2;
      }

      const isLosersFinal = lRound === losersRounds;

      for (let pos = 1; pos <= losersMatchesInRound; pos++) {
        matches.push({
          round: winnersRounds + lRound,
          matchNumber: globalMatchNumber++,
          participant1Id: null,
          participant2Id: null,
          status: 'PENDING',
          bracketPosition: {
            bracket: 'LOSERS' as BracketType,
            losersRound: lRound,
            position: pos,
            // Next match in losers bracket
            nextLosersMatch: isLosersFinal ? null : Math.ceil(pos / 2),
            nextLosersPosition: isReceivingRound ? 'participant2' : (pos % 2 === 1 ? 'participant1' : 'participant2'),
            isLosersFinal,
          },
        });
      }

      if (isReceivingRound && lRound < losersRounds) {
        losersMatchesInRound = losersMatchesInRound;
      }
    }

    // ===== GRAND FINALS =====
    matches.push({
      round: winnersRounds + losersRounds + 1,
      matchNumber: globalMatchNumber++,
      participant1Id: null,
      participant2Id: null,
      status: 'PENDING',
      bracketPosition: {
        bracket: 'GRAND_FINALS' as BracketType,
        position: 1,
        isGrandFinals: true,
        // participant1 = winners bracket champion
        // participant2 = losers bracket champion
      },
    });

    // Build bracket data for visualization
    const bracketData: any = {
      type: 'DOUBLE_ELIMINATION',
      winnersRounds,
      losersRounds,
      totalRounds: winnersRounds + losersRounds + 1,
      participantCount: seededParticipants.length,
      winners: this.buildDoubleEliminationRounds(matches, 'WINNERS', winnersRounds),
      losers: this.buildDoubleEliminationRounds(matches, 'LOSERS', losersRounds, winnersRounds),
      grandFinals: matches.filter(m => (m.bracketPosition as any).bracket === 'GRAND_FINALS'),
    };

    return { matches, bracketData };
  }

  /**
   * Build rounds for double elimination visualization
   */
  private buildDoubleEliminationRounds(
    matches: MatchData[],
    bracket: BracketType,
    numRounds: number,
    roundOffset = 0,
  ) {
    const rounds: any[] = [];

    for (let i = 1; i <= numRounds; i++) {
      const roundMatches = matches.filter(m => {
        const pos = m.bracketPosition;
        if (bracket === 'WINNERS') {
          return pos.bracket === 'WINNERS' && pos.winnersRound === i;
        } else {
          return pos.bracket === 'LOSERS' && pos.losersRound === i;
        }
      });

      rounds.push({
        round: i,
        name: bracket === 'WINNERS'
          ? (i === numRounds ? 'Winners Final' : `Winners Round ${i}`)
          : (i === numRounds ? 'Losers Final' : `Losers Round ${i}`),
        matches: roundMatches.map(m => ({
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
   * Advance winner to the next round (handles both single and double elimination)
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

    // Check if this is a double elimination bracket
    if (position.bracket) {
      await this.advanceDoubleElimination(match, winnerId, loserId, position);
      return;
    }

    // Single elimination logic
    if (!position.nextMatchNumber) {
      // This was the finals - tournament is complete
      await this.completeTournament(match.tournamentId, winnerId, loserId);
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
    await this.advanceToMatch(nextMatch.id, winnerId, position.nextMatchPosition);
  }

  /**
   * Handle double elimination bracket advancement
   */
  private async advanceDoubleElimination(
    match: any,
    winnerId: string,
    loserId: string | null,
    position: any,
  ) {
    const tournamentId = match.tournamentId;

    if (position.bracket === 'GRAND_FINALS') {
      // Grand finals complete - winner takes it all
      await this.completeTournament(tournamentId, winnerId, loserId);
      return;
    }

    if (position.bracket === 'WINNERS') {
      // Winner advances in winners bracket
      if (position.isWinnersFinal) {
        // Winners final - winner goes to grand finals as participant1
        const grandFinals = await this.findMatchByBracket(tournamentId, 'GRAND_FINALS', 1);
        if (grandFinals) {
          await this.advanceToMatch(grandFinals.id, winnerId, 'participant1');
        }
      } else if (position.nextWinnersMatch) {
        // Find next winners match
        const nextWinnersMatch = await this.findWinnersMatch(
          tournamentId,
          position.winnersRound + 1,
          position.nextWinnersMatch,
        );
        if (nextWinnersMatch) {
          await this.advanceToMatch(nextWinnersMatch.id, winnerId, position.nextWinnersPosition);
        }
      }

      // Loser drops to losers bracket
      if (loserId && position.losersRound) {
        const losersMatch = await this.findLosersMatch(
          tournamentId,
          position.losersRound,
          position.losersPosition,
        );
        if (losersMatch) {
          // In losers bracket, dropped players typically fill participant1 slot
          await this.advanceToMatch(losersMatch.id, loserId, 'participant1');
        }
      }
    } else if (position.bracket === 'LOSERS') {
      if (position.isLosersFinal) {
        // Losers final - winner goes to grand finals as participant2
        const grandFinals = await this.findMatchByBracket(tournamentId, 'GRAND_FINALS', 1);
        if (grandFinals) {
          await this.advanceToMatch(grandFinals.id, winnerId, 'participant2');
        }
        // Loser gets 3rd place
        if (loserId) {
          await this.prisma.tournamentParticipant.updateMany({
            where: {
              tournamentId,
              OR: [{ userId: loserId }, { teamId: loserId }],
            },
            data: { status: 'ELIMINATED', placement: 3 },
          });
        }
      } else if (position.nextLosersMatch) {
        // Advance in losers bracket
        const nextLosersMatch = await this.findLosersMatch(
          tournamentId,
          position.losersRound + 1,
          position.nextLosersMatch,
        );
        if (nextLosersMatch) {
          await this.advanceToMatch(nextLosersMatch.id, winnerId, position.nextLosersPosition);
        }
      }

      // Loser is eliminated (but not 3rd place unless losers final)
      if (loserId && !position.isLosersFinal) {
        await this.prisma.tournamentParticipant.updateMany({
          where: {
            tournamentId,
            OR: [{ userId: loserId }, { teamId: loserId }],
          },
          data: { status: 'ELIMINATED' },
        });
      }
    }
  }

  /**
   * Complete tournament and distribute prizes
   */
  private async completeTournament(tournamentId: string, winnerId: string, loserId: string | null) {
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'COMPLETED' },
    });

    // Update winner's participant record (1st place)
    await this.prisma.tournamentParticipant.updateMany({
      where: {
        tournamentId,
        OR: [{ userId: winnerId }, { teamId: winnerId }],
      },
      data: { status: 'WINNER', placement: 1 },
    });

    // Update loser's participant record (2nd place)
    if (loserId) {
      await this.prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId,
          OR: [{ userId: loserId }, { teamId: loserId }],
        },
        data: { status: 'ELIMINATED', placement: 2 },
      });
    }

    // Auto-distribute prizes
    try {
      await this.paymentsService.distributePrizes(tournamentId);
    } catch (error) {
      // Log error but don't fail the match completion
    }
  }

  /**
   * Advance a participant to a specific match
   */
  private async advanceToMatch(matchId: string, participantId: string, slot: 'participant1' | 'participant2') {
    const updateField = slot === 'participant1'
      ? { participant1Id: participantId }
      : { participant2Id: participantId };

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: updateField,
    });

    // Check if the match is ready (both participants set)
    if (updatedMatch.participant1Id && updatedMatch.participant2Id) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: 'READY' },
      });
    }
  }

  /**
   * Find match by bracket type and position
   */
  private async findMatchByBracket(tournamentId: string, bracket: BracketType, position: number) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
    });

    return matches.find(m => {
      const pos = m.bracketPosition as any;
      return pos.bracket === bracket && pos.position === position;
    });
  }

  /**
   * Find winners bracket match
   */
  private async findWinnersMatch(tournamentId: string, winnersRound: number, position: number) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
    });

    return matches.find(m => {
      const pos = m.bracketPosition as any;
      return pos.bracket === 'WINNERS' && pos.winnersRound === winnersRound && pos.position === position;
    });
  }

  /**
   * Find losers bracket match
   */
  private async findLosersMatch(tournamentId: string, losersRound: number, position: number) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
    });

    return matches.find(m => {
      const pos = m.bracketPosition as any;
      return pos.bracket === 'LOSERS' && pos.losersRound === losersRound && pos.position === position;
    });
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
