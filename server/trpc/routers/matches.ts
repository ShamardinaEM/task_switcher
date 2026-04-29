import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../init';
import * as schema from '../../db/schema';

export const matchesRouter = router({
  // История матчей текущего пользователя (с командой и результатом)
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.participants.findMany({
      where: eq(schema.participants.userId, ctx.user.id),
      with: {
        match: {
          with: {
            matchTeams: { with: { team: true } },
          },
        },
        team: true,
      },
      orderBy: (p, { desc }) => [desc(p.id)],
    });

    return rows.map((p) => {
      const match = p.match;
      const won = match.winningTeamId === p.teamId;
      const finished = match.status === 'finished';
      return {
        matchId: match.id,
        roomCode: match.roomCode,
        status: match.status,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
        teamName: p.team?.name ?? '—',
        won: finished ? won : null,   // null = не завершён
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        totalRounds: p.correct + p.wrong,
      };
    });
  }),

  // Детали конкретного матча
  get: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.query.matches.findFirst({
        where: eq(schema.matches.id, input.matchId),
        with: {
          matchTeams: { with: { team: true } },
        },
      });
      if (!match) throw new TRPCError({ code: 'NOT_FOUND' });

      const parts = await ctx.db.query.participants.findMany({
        where: eq(schema.participants.matchId, input.matchId),
        with: { user: true },
      });

      return { match, participants: parts };
    }),
});
