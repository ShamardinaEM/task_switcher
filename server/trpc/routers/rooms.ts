import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure } from '../init';
import * as schema from '../../db/schema';
import {
  createRoom,
  joinRoom,
  chooseTeam,
  addBot,
  startGame,
  getRoom,
  getRoomByCode,
  submitAnswer,
  leaveRoom,
  becomeSpectator,
  deleteMatch,
  rooms,
} from '../../game/store';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export const roomsRouter = router({
    // ─── Создать комнату ────────────────────────────────────────────────────────
    create: protectedProcedure
        .input(
            z.object({
                maxPlayersPerTeam: z.number().min(2).max(3).default(2),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const code = generateCode();
            const matchId = crypto.randomUUID();
            const teamAId = crypto.randomUUID();
            const teamBId = crypto.randomUUID();

            await ctx.db.transaction(async (tx) => {
                await tx.insert(schema.teams).values([
                    {
                        id: teamAId,
                        name: "Команда Red",
                        createdAt: new Date(),
                    },
                    {
                        id: teamBId,
                        name: "Команда Blue",
                        createdAt: new Date(),
                    },
                ]);

                await tx.insert(schema.matches).values({
                    id: matchId,
                    roomCode: code,
                    status: "waiting",
                    createdAt: new Date(),
                });

                await tx.insert(schema.matchTeams).values([
                    {
                        id: crypto.randomUUID(),
                        matchId,
                        teamId: teamAId,
                        totalScore: 0,
                    },
                    {
                        id: crypto.randomUUID(),
                        matchId,
                        teamId: teamBId,
                        totalScore: 0,
                    },
                ]);

                await tx.insert(schema.participants).values({
                    id: crypto.randomUUID(),
                    matchId,
                    userId: ctx.user.id,
                    teamId: teamAId,
                    score: 0,
                    correct: 0,
                    wrong: 0,
                    isBot: false,
                });
            });

            const room = createRoom({
                matchId,
                code,
                hostId: ctx.user.id,
                teamAId,
                teamBId,
                maxPlayersPerTeam: input.maxPlayersPerTeam,
            });

            // Хост попадает в Команду 1
            joinRoom(matchId, {
                userId: ctx.user.id,
                name: ctx.user.name,
                isBot: false,
                score: 0,
                correct: 0,
                wrong: 0,
            });

            return { roomId: matchId, code };
        }),

    // ─── Войти по коду ──────────────────────────────────────────────────────────
    join: protectedProcedure
        .input(z.object({ code: z.string().length(6) }))
        .mutation(async ({ ctx, input }) => {
            const room = getRoomByCode(input.code.toUpperCase());
            if (!room)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Комната не найдена",
                });
            if (room.status !== "waiting")
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Игра уже началась",
                });

            const joined = joinRoom(room.id, {
                userId: ctx.user.id,
                name: ctx.user.name,
                isBot: false,
                score: 0,
                correct: 0,
                wrong: 0,
            });
            if (!joined)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Комната заполнена",
                });

            // Определяем в какую команду попал игрок
            const teamId = room.teams[0].members.some(
                (m) => m.userId === ctx.user.id,
            )
                ? room.teams[0].id
                : room.teams[1].id;

            const existing = await ctx.db.query.participants.findFirst({
                where: (p, { and }) =>
                    and(eq(p.matchId, room.id), eq(p.userId, ctx.user.id)),
            });

            if (!existing) {
                await ctx.db.insert(schema.participants).values({
                    id: crypto.randomUUID(),
                    matchId: room.id,
                    userId: ctx.user.id,
                    teamId,
                    score: 0,
                    correct: 0,
                    wrong: 0,
                    isBot: false,
                });
            }

            return { roomId: room.id };
        }),

    // ─── Сменить команду ────────────────────────────────────────────────────────
    chooseTeam: protectedProcedure
        .input(
            z.object({
                roomId: z.string(),
                teamIndex: z.union([z.literal(0), z.literal(1)]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const result = chooseTeam(
                input.roomId,
                ctx.user.id,
                input.teamIndex,
            );
            if (!result.ok)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: result.reason,
                });

            const room = getRoom(input.roomId)!;
            const newTeamId = room.teams[input.teamIndex].id;

            // Если игрок был наблюдателем — его participant удалён, нужно вставить заново
            const existing = await ctx.db.query.participants.findFirst({
                where: and(
                    eq(schema.participants.matchId, input.roomId),
                    eq(schema.participants.userId, ctx.user.id),
                ),
            });

            if (existing) {
                await ctx.db
                    .update(schema.participants)
                    .set({ teamId: newTeamId })
                    .where(
                        and(
                            eq(schema.participants.userId, ctx.user.id),
                            eq(schema.participants.matchId, input.roomId),
                        ),
                    );
            } else {
                await ctx.db.insert(schema.participants).values({
                    id: crypto.randomUUID(),
                    matchId: input.roomId,
                    userId: ctx.user.id,
                    teamId: newTeamId,
                    score: 0,
                    correct: 0,
                    wrong: 0,
                    isBot: false,
                });
            }

            return { ok: true };
        }),

    // ─── Добавить бота ──────────────────────────────────────────────────────────
    addBot: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const { roomId } = input;
            const result = addBot(roomId);
            if (!result.ok) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Не удалось добавить ботов",
                });
            }

            // Записываем каждого бота в users + participants, чтобы они
            // отображались в составе команды и в рейтинге
            const room = getRoom(roomId);
            for (const botId of result.botIds ?? []) {
                // Находим команду бота в актуальном состоянии комнаты
                let teamId: string | undefined;
                for (const team of room?.teams ?? []) {
                    if (team.members.some((m) => m.userId === botId)) {
                        teamId = team.id;
                        break;
                    }
                }
                if (!teamId) continue;

                await ctx.db.transaction(async (tx) => {
                    await tx.insert(schema.users).values({
                        id: botId,
                        name: "🤖 Бот",
                        email: `${botId}@bot.local`,
                        emailVerified: false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    await tx.insert(schema.participants).values({
                        id: crypto.randomUUID(),
                        matchId: roomId,
                        userId: botId,
                        teamId,
                        score: 0,
                        correct: 0,
                        wrong: 0,
                        isBot: true,
                    });
                });
            }

            return { botIds: result.botIds };
        }),

    // ─── Начать игру ────────────────────────────────────────────────────────────
    // Мутация только валидирует запрос и сразу возвращает OK (<10ms).
    // Игровой цикл (Pusher-события, раунды) запускается в фоне.
    start: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(({ ctx, input }) => {
            const room = getRoom(input.roomId);
            if (!room) throw new TRPCError({ code: "NOT_FOUND" });
            if (room.hostId !== ctx.user.id)
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Только хост может начать игру",
                });

            const total =
                room.teams[0].members.length + room.teams[1].members.length;
            if (total < 4)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Нужно минимум 2 игрока в каждой команде",
                });

            // Не await — возвращаем ответ клиенту немедленно
            const started = startGame(input.roomId);
            if (!started)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Игра уже запущена",
                });

            return { ok: true };
        }),

    // ─── Состояние комнаты ──────────────────────────────────────────────────────
    get: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .query(({ input }) => {
            const room = getRoom(input.roomId);
            if (!room) throw new TRPCError({ code: "NOT_FOUND" });
            return {
                id: room.id,
                code: room.code,
                hostId: room.hostId,
                status: room.status,
                maxPlayersPerTeam: room.maxPlayersPerTeam,
                teams: room.teams.map((t) => ({
                    id: t.id,
                    name: t.name,
                    score: t.score,
                    members: t.members.map((m) => ({
                        userId: m.userId,
                        name: m.name,
                        score: m.score,
                        isBot: m.isBot,
                    })),
                })),
                spectators: room.spectators,
                roundNumber: room.roundNumber,
                maxRounds: room.maxRounds,
            };
        }),

    // ─── Стать наблюдателем ─────────────────────────────────────────────────────
    spectate: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const ok = becomeSpectator(input.roomId, ctx.user.id, ctx.user.name);
            if (!ok)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Нельзя стать наблюдателем",
                });

            // Удаляем запись участника из БД
            await ctx.db
                .delete(schema.participants)
                .where(
                    and(
                        eq(schema.participants.matchId, input.roomId),
                        eq(schema.participants.userId, ctx.user.id),
                    ),
                );

            return { ok: true };
        }),

    // ─── Выйти из комнаты ───────────────────────────────────────────────────────
    leave: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await leaveRoom(input.roomId, ctx.user.id);
            return { ok: true };
        }),

    // ─── Ответить на раунд ──────────────────────────────────────────────────────
    answer: protectedProcedure
        .input(
            z.object({
                roomId: z.string(),
                roundId: z.string(),
                answer: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const result = await submitAnswer({
                roomId: input.roomId,
                roundId: input.roundId,
                userId: ctx.user.id,
                answer: input.answer,
            });
            if (!result)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Ответ не принят",
                });
            return result;
        }),

    // ─── Ручная очистка зависших комнат ─────────────────────────────────────────
    cleanup: protectedProcedure.mutation(async ({ ctx }) => {
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

        const staleMatches = await ctx.db
            .select({ id: schema.matches.id })
            .from(schema.matches)
            .where(
                and(
                    eq(schema.matches.status, "waiting"),
                    sql`${schema.matches.createdAt} < ${twoMinAgo.toISOString()}`,
                ),
            );

        let cleanedCount = 0;
        for (const match of staleMatches) {
            await deleteMatch(match.id).catch(() => null);
            cleanedCount++;
        }

        return { cleaned: cleanedCount };
    }),
});

