import { desc, eq, and, sql } from "drizzle-orm";
import { router, publicProcedure } from "../init";
import * as schema from "../../db/schema";

export const leaderboardRouter = router({
    // Топ команд — группируем по teamId + matchId
    teams: publicProcedure.query(async ({ ctx }) => {
        const matchResults = await ctx.db
            .select({
                teamId: schema.matchTeams.teamId,
                teamName: schema.teams.name,
                matchId: schema.matches.id,
                totalScore: schema.matchTeams.totalScore,
                isWinner: sql<boolean>`${schema.matches.winningTeamId} = ${schema.matchTeams.teamId}`,
                endedAt: schema.matches.endedAt,
            })
            .from(schema.matchTeams)
            .innerJoin(
                schema.teams,
                eq(schema.matchTeams.teamId, schema.teams.id),
            )
            .innerJoin(
                schema.matches,
                and(
                    eq(schema.matches.id, schema.matchTeams.matchId),
                    eq(schema.matches.status, "finished"),
                ),
            )
            .orderBy(desc(schema.matchTeams.totalScore))
            .limit(10);

        if (matchResults.length === 0) return [];

        const teamsWithMembers = await Promise.all(
            matchResults.map(async (result) => {
                const participants = await ctx.db
                    .select({
                        id: schema.users.id,
                        name: schema.users.name,
                        image: schema.users.image,
                        score: schema.participants.score,
                        correct: schema.participants.correct,
                        wrong: schema.participants.wrong,
                        isBot: schema.participants.isBot,
                    })
                    .from(schema.participants)
                    .innerJoin(
                        schema.users,
                        eq(schema.participants.userId, schema.users.id),
                    )
                    .where(
                        and(
                            eq(schema.participants.teamId, result.teamId),
                            eq(schema.participants.matchId, result.matchId),
                        ),
                    );

                return {
                    id: result.teamId,
                    matchId: result.matchId,
                    name: result.teamName,
                    totalScore: result.totalScore,
                    wins: result.isWinner ? 1 : 0,
                    matchesPlayed: 1,
                    endedAt: result.endedAt,
                    members: participants,
                };
            }),
        );

        return teamsWithMembers;
    }),

    // Агрегированная статистика по командам (для винрейта)
    teamsAggregated: publicProcedure.query(async ({ ctx }) => {
        const teams = await ctx.db
            .select({
                id: schema.teams.id,
                name: schema.teams.name,
                totalScore: sql<number>`SUM(${schema.matchTeams.totalScore})`,
                wins: sql<number>`COUNT(CASE WHEN ${schema.matches.winningTeamId} = ${schema.teams.id} THEN 1 END)`,
                matchesPlayed: sql<number>`COUNT(DISTINCT ${schema.matchTeams.matchId})`,
            })
            .from(schema.teams)
            .innerJoin(
                schema.matchTeams,
                eq(schema.matchTeams.teamId, schema.teams.id),
            )
            .innerJoin(
                schema.matches,
                and(
                    eq(schema.matches.id, schema.matchTeams.matchId),
                    eq(schema.matches.status, "finished"),
                ),
            )
            .groupBy(schema.teams.id);

        if (teams.length === 0) return [];

        return teams.map((team) => ({
            id: team.id,
            name: team.name,
            totalScore: Number(team.totalScore) || 0,
            wins: Number(team.wins) || 0,
            matchesPlayed: Number(team.matchesPlayed) || 0,
            members: [],
        }));
    }),

    // Рейтинг игроков
    players: publicProcedure.query(async ({ ctx }) => {
        const rows = await ctx.db
            .select({
                userId: schema.participants.userId,
                name: schema.users.name,
                image: schema.users.image,
                totalScore: sql<number>`sum(${schema.participants.score})`,
                totalCorrect: sql<number>`sum(${schema.participants.correct})`,
                totalWrong: sql<number>`sum(${schema.participants.wrong})`,
                matchesPlayed: sql<number>`count(distinct ${schema.participants.matchId})`,
            })
            .from(schema.participants)
            .innerJoin(
                schema.users,
                eq(schema.participants.userId, schema.users.id),
            )
            .where(eq(schema.participants.isBot, false))
            .groupBy(
                schema.participants.userId,
                schema.users.name,
                schema.users.image,
            )
            .orderBy(desc(sql`sum(${schema.participants.score})`))
            .limit(20);

        return rows.map((row) => ({
            ...row,
            totalScore: Number(row.totalScore),
            totalCorrect: Number(row.totalCorrect),
            totalWrong: Number(row.totalWrong),
            matchesPlayed: Number(row.matchesPlayed),
        }));
    }),
});
