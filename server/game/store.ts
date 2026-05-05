import "server-only";
import type { GameRoom, RoomMember, TeamState } from "./types";
import { generateRound, checkAnswer, calcScoreDelta } from "./engine";
import { scheduleBot } from "./bot";
import { pusherServer, gameChannel, PusherEvent } from "../pusher";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, and, or, lt } from "drizzle-orm";

export const rooms = new Map<string, GameRoom>();

// ─── Фиксированный пул ботов ──────────────────────────────────────────────────

export const FIXED_BOTS = [
    { id: "bot-001", name: "🤖 Бот 1" },
    { id: "bot-002", name: "🤖 Бот 2" },
    { id: "bot-003", name: "🤖 Бот 3" },
    { id: "bot-004", name: "🤖 Бот 4" },
    { id: "bot-005", name: "🤖 Бот 5" },
    { id: "bot-006", name: "🤖 Бот 6" },
] as const;

async function initBots(): Promise<void> {
    for (const bot of FIXED_BOTS) {
        await db
            .insert(schema.users)
            .values({
                id: bot.id,
                name: bot.name,
                email: `${bot.id}@bot.local`,
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoNothing();
    }
}

async function triggerSafe(
    channel: string,
    event: string,
    data: object,
): Promise<void> {
    try {
        await pusherServer.trigger(channel, event, data);
    } catch {
        await new Promise((r) => setTimeout(r, 600));
        try {
            await pusherServer.trigger(channel, event, data);
        } catch (err) {
            console.error(`[Pusher] trigger failed for event "${event}":`, err);
        }
    }
}

// ─── Удаление матча ───────────────────────────────────────────────────────────

export async function deleteMatch(matchId: string): Promise<void> {
    const room = rooms.get(matchId);
    if (room?.roundTimer) clearTimeout(room.roundTimer);
    rooms.delete(matchId);

    await db.transaction(async (tx) => {
        const matchTeamRows = await tx
            .select({ teamId: schema.matchTeams.teamId })
            .from(schema.matchTeams)
            .where(eq(schema.matchTeams.matchId, matchId));

        await tx
            .delete(schema.participants)
            .where(eq(schema.participants.matchId, matchId));
        await tx
            .delete(schema.matchTeams)
            .where(eq(schema.matchTeams.matchId, matchId));

        for (const mt of matchTeamRows) {
            await tx
                .delete(schema.teams)
                .where(eq(schema.teams.id, mt.teamId));
        }

        await tx
            .delete(schema.matches)
            .where(eq(schema.matches.id, matchId));
    });
}

// ─── Выход из комнаты ─────────────────────────────────────────────────────────

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room || room.status !== "waiting") return;

    const specIdx = room.spectators.findIndex((s) => s.userId === userId);
    if (specIdx !== -1) {
        room.spectators.splice(specIdx, 1);
        return;
    }

    for (const team of room.teams) {
        const idx = team.members.findIndex((m) => m.userId === userId);
        if (idx !== -1) {
            team.members.splice(idx, 1);
            break;
        }
    }

    const realPlayers = room.teams
        .flatMap((t) => t.members)
        .filter((m) => !m.isBot);

    if (realPlayers.length === 0) {
        await deleteMatch(roomId);
    } else {
        await db
            .delete(schema.participants)
            .where(
                and(
                    eq(schema.participants.matchId, roomId),
                    eq(schema.participants.userId, userId),
                ),
            );
    }
}

// ─── Стать наблюдателем ───────────────────────────────────────────────────────

export function becomeSpectator(
    roomId: string,
    userId: string,
    name: string,
): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== "waiting") return false;

    for (const team of room.teams) {
        const idx = team.members.findIndex((m) => m.userId === userId);
        if (idx !== -1) {
            team.members.splice(idx, 1);
            break;
        }
    }

    if (!room.spectators.some((s) => s.userId === userId)) {
        room.spectators.push({ userId, name });
    }

    return true;
}

// ─── Периодическая очистка зависших матчей ────────────────────────────────────

async function cleanupStaleMatches(): Promise<void> {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

    const stale = await db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(
            or(
                and(
                    eq(schema.matches.status, "waiting"),
                    lt(schema.matches.createdAt, twoMinAgo),
                ),
                and(
                    eq(schema.matches.status, "playing"),
                    lt(schema.matches.startedAt, fifteenMinAgo),
                ),
            ),
        );

    for (const match of stale) {
        await deleteMatch(match.id).catch((err) =>
            console.error(`[cleanup] failed to delete match ${match.id}:`, err),
        );
    }
}

// Защита от дублирования при hot-reload в dev
declare global {
    var _matchCleanupInterval: ReturnType<typeof setInterval> | undefined;
    var _botsInitialized: boolean | undefined;
}
if (!global._matchCleanupInterval) {
    global._matchCleanupInterval = setInterval(
        () => void cleanupStaleMatches(),
        30_000,
    );
}
if (!global._botsInitialized) {
    global._botsInitialized = true;
    void initBots();
}

// ─── Геттеры ─────────────────────────────────────────────────────────────────

export function getRoom(roomId: string): GameRoom | undefined {
    return rooms.get(roomId);
}

export function getRoomByCode(code: string): GameRoom | undefined {
    for (const room of rooms.values()) {
        if (room.code === code) return room;
    }
    return undefined;
}

// ─── Создание комнаты ─────────────────────────────────────────────────────────

export function createRoom(opts: {
    matchId: string;
    code: string;
    hostId: string;
    teamAId: string;
    teamBId: string;
    maxPlayersPerTeam: number;
}): GameRoom {
    const room: GameRoom = {
        id: opts.matchId,
        code: opts.code,
        hostId: opts.hostId,
        status: "waiting",
        maxPlayersPerTeam: opts.maxPlayersPerTeam,
        teams: [
            { id: opts.teamAId, name: "Команда Red", members: [], score: 0 },
            { id: opts.teamBId, name: "Команда Blue", members: [], score: 0 },
        ],
        spectators: [],
        currentRound: null,
        roundNumber: 0,
        maxRounds: 10,
        answeredInRound: new Set(),
        roundTimer: null,
    };
    rooms.set(opts.matchId, room);
    return room;
}

// ─── Вступление в комнату ─────────────────────────────────────────────────────

export function joinRoom(
    roomId: string,
    member: RoomMember,
    preferredTeamIndex?: 0 | 1,
): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== "waiting") return false;

    const total = room.teams[0].members.length + room.teams[1].members.length;
    if (total >= room.maxPlayersPerTeam * 2) return false;

    for (const team of room.teams) {
        if (team.members.some((m) => m.userId === member.userId)) return true;
    }

    let team;
    if (
        preferredTeamIndex !== undefined &&
        preferredTeamIndex >= 0 &&
        preferredTeamIndex <= 1
    ) {

        const preferred = room.teams[preferredTeamIndex];
        if (preferred.members.length < room.maxPlayersPerTeam) {
            team = preferred;
        } else {
            team = room.teams[preferredTeamIndex === 0 ? 1 : 0];
            if (team.members.length >= room.maxPlayersPerTeam) return false;
        }
    } else {
        team =
            room.teams[0].members.length <= room.teams[1].members.length
                ? room.teams[0]
                : room.teams[1];
    }

    team.members.push(member);
    return true;
}

// ─── Смена команды ────────────────────────────────────────────────────────────

export function chooseTeam(
    roomId: string,
    userId: string,
    teamIndex: 0 | 1,
): { ok: boolean; reason?: string } {
    const room = rooms.get(roomId);
    if (!room || room.status !== "waiting")
        return { ok: false, reason: "Игра уже началась" };

    const targetTeam = room.teams[teamIndex];
    if (targetTeam.members.length >= room.maxPlayersPerTeam)
        return { ok: false, reason: "Команда заполнена" };

    let member: RoomMember | undefined;
    for (const team of room.teams) {
        const idx = team.members.findIndex((m) => m.userId === userId);
        if (idx !== -1) {
            [member] = team.members.splice(idx, 1);
            break;
        }
    }

    if (!member) {
        const specIdx = room.spectators.findIndex((s) => s.userId === userId);
        if (specIdx !== -1) {
            const spec = room.spectators[specIdx];
            room.spectators.splice(specIdx, 1);
            member = { userId: spec.userId, name: spec.name, isBot: false, score: 0, correct: 0, wrong: 0 };
        }
    }

    if (!member) return { ok: false, reason: "Игрок не найден" };

    targetTeam.members.push(member);
    return { ok: true };
}

// ─── Добавление бота ─────────────────────────────────────────────────────────

export function addBot(roomId: string): { ok: boolean; botIds?: string[] } {
    const room = rooms.get(roomId);
    if (!room) return { ok: false };

    // Боты, уже занятые в этой комнате
    const usedBotIds = new Set(
        room.teams.flatMap((t) => t.members.filter((m) => m.isBot).map((m) => m.userId)),
    );

    // Свободные боты из фиксированного пула
    const available = FIXED_BOTS.filter((b) => !usedBotIds.has(b.id));

    const botIds: string[] = [];
    let poolIndex = 0;

    function pickBot(teamIndex: 0 | 1): boolean {
        if (poolIndex >= available.length) return false;
        const bot = available[poolIndex++];
        const added = joinRoom(
            roomId,
            { userId: bot.id, name: bot.name, isBot: true, score: 0, correct: 0, wrong: 0 },
            teamIndex,
        );
        if (added) botIds.push(bot.id);
        return added;
    }

    const team0Size = room.teams[0].members.length;
    const team1Size = room.teams[1].members.length;

    if (team0Size === team1Size) {
        // Добавляем по одному в каждую команду
        for (let i = 0; i < room.teams.length; i++) {
            if (room.teams[i].members.length < room.maxPlayersPerTeam) {
                pickBot(i as 0 | 1);
            }
        }
    } else {
        // Добавляем в меньшую
        const targetIndex = team0Size < team1Size ? 0 : 1;
        if (room.teams[targetIndex].members.length < room.maxPlayersPerTeam) {
            pickBot(targetIndex);
        }
    }

    return { ok: botIds.length > 0, botIds };
}

// ─── Запуск игры ─────────────────────────────────────────────────────────────

export function startGame(roomId: string): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== "waiting") return false;
    room.status = "playing";
    void runGameLoop(roomId);
    return true;
}

async function runGameLoop(roomId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room) return;

    await db
        .update(schema.matches)
        .set({ status: "playing", startedAt: new Date() })
        .where(eq(schema.matches.id, roomId));

    await nextRound(roomId);
}

// ─── Следующий раунд ─────────────────────────────────────────────────────────

async function nextRound(roomId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;

    if (room.roundNumber >= room.maxRounds) {
        await endGame(roomId);
        return;
    }

    room.roundNumber += 1;
    room.answeredInRound = new Set();

    const roundId = crypto.randomUUID();
    const round = generateRound(roundId);
    room.currentRound = round;

    await triggerSafe(gameChannel(roomId), PusherEvent.ROUND_START, {
        roundId,
        roundNumber: room.roundNumber,
        symbol: round.symbol,
        rule: round.rule,
        durationMs: round.durationMs,
    });
    for (const team of room.teams) {
        for (const member of team.members) {
            if (member.isBot) {
                scheduleBot({
                    roomId,
                    roundId,
                    userId: member.userId,
                    correctAnswer: round.correctAnswer,
                    accuracy: 0.7,
                    onAnswer: submitAnswer,
                });
            }
        }
    }

    room.roundTimer = setTimeout(() => void endRound(roomId), round.durationMs);
}

// ─── Конец раунда ────────────────────────────────────────────────────────────

async function endRound(roomId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room || !room.currentRound) return;

    await triggerSafe(gameChannel(roomId), PusherEvent.ROUND_END, {
        roundId: room.currentRound.id,
        correctAnswer: room.currentRound.correctAnswer,
        scores: serializeTeams(room.teams),
    });

    room.currentRound = null;
    await nextRound(roomId);
}

// ─── Ответ игрока / бота ─────────────────────────────────────────────────────

export async function submitAnswer(opts: {
    roomId: string;
    roundId: string;
    userId: string;
    answer: string;
}): Promise<{
    isCorrect: boolean;
    playerDelta: number;
    teamDelta: number;
} | null> {
    const room = rooms.get(opts.roomId);
    if (!room || room.status !== "playing") return null;
    if (!room.currentRound || room.currentRound.id !== opts.roundId)
        return null;
    if (room.answeredInRound.has(opts.userId)) return null;

    room.answeredInRound.add(opts.userId);

    const isCorrect = checkAnswer(room.currentRound, opts.answer);
    const responseMs = Date.now() - room.currentRound.startedAt;
    const { playerDelta, teamDelta } = calcScoreDelta(isCorrect, responseMs);

    let playerTeam: TeamState | undefined;
    for (const team of room.teams) {
        const member = team.members.find((m) => m.userId === opts.userId);
        if (member) {
            member.score += playerDelta;
            if (isCorrect) member.correct += 1;
            else member.wrong += 1;
            team.score = Math.max(0, team.score + teamDelta);
            playerTeam = team;
            break;
        }
    }
    if (!playerTeam) return null;
    void triggerSafe(gameChannel(opts.roomId), PusherEvent.SCORE_UPDATE, {
        teams: serializeTeams(room.teams),
    });

    return { isCorrect, playerDelta, teamDelta };
}

// ─── Конец игры ──────────────────────────────────────────────────────────────

async function endGame(roomId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.status = "finished";

    const [t1, t2] = room.teams;
    const winningTeam = t1.score >= t2.score ? t1 : t2;

    await db.transaction(async (tx) => {
        await tx
            .update(schema.matches)
            .set({
                status: "finished",
                endedAt: new Date(),
                winningTeamId: winningTeam.id,
            })
            .where(eq(schema.matches.id, roomId));

        for (const team of room.teams) {
            await tx
                .update(schema.matchTeams)
                .set({ totalScore: team.score })
                .where(eq(schema.matchTeams.teamId, team.id));

            for (const member of team.members) {
                await tx
                    .update(schema.participants)
                    .set({
                        score: member.score,
                        correct: member.correct,
                        wrong: member.wrong,
                    })
                    .where(
                        and(
                            eq(schema.participants.userId, member.userId),
                            eq(schema.participants.matchId, roomId),
                        ),
                    );
            }
        }
    });

    await triggerSafe(gameChannel(roomId), PusherEvent.GAME_END, {
        winningTeamId: winningTeam.id,
        teams: serializeTeams(room.teams),
    });

    setTimeout(() => {
        rooms.delete(roomId);
    }, 30_000);
}

// ─── Вспомогательное ─────────────────────────────────────────────────────────

function serializeTeams(teams: [TeamState, TeamState]) {
    return teams.map((t) => ({
        id: t.id,
        name: t.name,
        score: t.score,
        members: t.members.map((m) => ({
            userId: m.userId,
            name: m.name,
            score: m.score,
            correct: m.correct,
            wrong: m.wrong,
            isBot: m.isBot,
        })),
    }));
}
