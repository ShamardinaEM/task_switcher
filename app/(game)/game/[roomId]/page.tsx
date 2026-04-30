"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { subscribeToGame } from "@/lib/pusher-client";
import { useSession, signOut } from "@/lib/auth-client";
import type { GameRule } from "@/server/game/types";

const TEAM_STYLE = [
    {
        border: "border-red-500",
        bg: "bg-red-900/20",
        text: "text-red-400",
        btn: "bg-red-700 hover:bg-red-600 border-red-600",
        scoreText: "text-red-400",
    },
    {
        border: "border-blue-500",
        bg: "bg-blue-900/20",
        text: "text-blue-400",
        btn: "bg-blue-700 hover:bg-blue-600 border-blue-600",
        scoreText: "text-blue-400",
    },
] as const;

interface TeamMember {
    userId: string;
    name: string;
    score: number;
    correct?: number;
    wrong?: number;
    isBot?: boolean;
}

interface TeamScore {
    id: string;
    name: string;
    score: number;
    members: TeamMember[];
}

interface MemberRoundStatus {
    answered: boolean;
    delta: number;
    isCorrect: boolean;
}

interface RoundState {
    roundId: string;
    roundNumber: number;
    symbol: string;
    rule: GameRule;
    durationMs: number;
    startedAt: number;
}

export default function GamePage({
    params,
}: {
    params: Promise<{ roomId: string }>;
}) {
    const { roomId } = use(params);
    const router = useRouter();
    const { data: session } = useSession();

    const [gameStatus, setGameStatus] = useState<
        "waiting" | "playing" | "finished"
    >("waiting");
    const [round, setRound] = useState<RoundState | null>(null);
    const [answered, setAnswered] = useState(false);
    const [lastResult, setLastResult] = useState<{
        isCorrect: boolean;
        playerDelta: number;
    } | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [roundStatuses, setRoundStatuses] = useState<Record<string, MemberRoundStatus>>({});
    const [liveTeams, setLiveTeams] = useState<TeamScore[] | null>(null);
    const baseScoresRef = useRef<Record<string, { score: number; correct: number; wrong: number }>>({});
    const latestTeamsRef = useRef<TeamScore[]>([]);

    const {
        data: room,
        refetch,
        isLoading,
    } = trpc.rooms.get.useQuery(
        { roomId },
        {
            refetchInterval: gameStatus === "playing" ? 10000 : 2000,
            enabled: !!roomId,
        },
    );

    const startGame = trpc.rooms.start.useMutation({
        onSuccess: () => refetch(),
    });
    const spectateMutation = trpc.rooms.spectate.useMutation({
        onSuccess: () => refetch(),
    });
    const addBot = trpc.rooms.addBot.useMutation({
        onSuccess: () => refetch()
    });
    const chooseTeam = trpc.rooms.chooseTeam.useMutation({
        onSuccess: () => refetch(),
    });
    const answerMutation = trpc.rooms.answer.useMutation({
        onSuccess: (data) => {
            setAnswered(true);
            setLastResult(data);
        },
    });

    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = subscribeToGame(roomId, {
            "score:update": (data: unknown) => {
                const d = data as { teams: TeamScore[] };
                if (!d?.teams) return;
                latestTeamsRef.current = d.teams;
                setLiveTeams(d.teams);

                setRoundStatuses((prev) => {
                    const next = { ...prev };
                    for (const team of d.teams) {
                        for (const m of team.members ?? []) {
                            if (next[m.userId]?.answered) continue;
                            const base = baseScoresRef.current[m.userId] ?? { score: 0, correct: 0, wrong: 0 };
                            const currentTotal = (m.correct ?? 0) + (m.wrong ?? 0);
                            if (currentTotal > base.correct + base.wrong) {
                                next[m.userId] = {
                                    answered: true,
                                    delta: m.score - base.score,
                                    isCorrect: m.score > base.score,
                                };
                            }
                        }
                    }
                    return next;
                });
            },
            "round:start": (data: unknown) => {
                const d = data as RoundState;
                setRound({ ...d, startedAt: Date.now() });
                setAnswered(false);
                setLastResult(null);
                setTimeLeft(Math.ceil(d.durationMs / 1000));
                if (latestTeamsRef.current.length > 0) {
                    setLiveTeams([...latestTeamsRef.current]);
                }
                const snapshot: typeof baseScoresRef.current = {};
                for (const team of latestTeamsRef.current) {
                    for (const m of team.members ?? []) {
                        snapshot[m.userId] = {
                            score: m.score,
                            correct: m.correct ?? 0,
                            wrong: m.wrong ?? 0,
                        };
                    }
                }
                baseScoresRef.current = snapshot;
                setRoundStatuses({});
            },
            "round:end": (data: unknown) => {
                setTimeLeft(0);
                const d = data as { scores?: TeamScore[] };
                if (d?.scores) {
                    latestTeamsRef.current = d.scores;
                    setLiveTeams(d.scores);
                }
            },
            "game:end": () => {
                setGameStatus("finished");
                router.push(`/results/${roomId}`);
            },
        });
        return unsubscribe;
    }, [roomId, router, refetch]);

    useEffect(() => {
        if (room?.status === "playing" && gameStatus !== "playing") {
            setGameStatus("playing");
        }
    }, [room?.status, gameStatus]);

    useEffect(() => {
        if (!round) return;
        const interval = setInterval(() => {
            const elapsed = (Date.now() - round.startedAt) / 1000;
            setTimeLeft(
                Math.max(0, Math.ceil(round.durationMs / 1000 - elapsed)),
            );
        }, 200);
        return () => clearInterval(interval);
    }, [round]);

    if (isLoading) {
        return (
            <main className="flex flex-1 items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </main>
        );
    }

    if (!room) {
        return (
            <main className="flex flex-1 items-center justify-center">
                <p className="text-zinc-400">Комната не найдена</p>
            </main>
        );
    }

    const userId = session?.user?.id ?? "";
    const isHost = room.hostId === userId;
    const roomTeams = room.teams ?? [];

    const displayTeams = (liveTeams ?? roomTeams) as typeof roomTeams;

    const myTeamIndex = roomTeams.findIndex((team) =>
        team?.members?.some((member) => member?.userId === userId),
    );

    const handleAddBot = () => {
        addBot.mutate({ roomId });
    };
    if (gameStatus === "playing" || room.status === "playing") {

        return (
            <main className="flex flex-1 flex-col items-center gap-5 p-4">

                <div className="flex gap-4 w-full max-w-2xl">
                    {displayTeams.map((team, i) => {
                        const style = TEAM_STYLE[i] ?? TEAM_STYLE[0];
                        const isMyTeam = myTeamIndex === i;
                        return (
                            <div
                                key={team.id}
                                className={`flex-1 rounded-xl border ${style.border} ${style.bg} flex flex-col overflow-hidden`}
                            >
                                <div className="p-3 text-center">
                                    <p className={`text-xs font-semibold ${style.text}`}>
                                        {team.name}
                                        {isMyTeam && <span className="ml-1 font-normal text-zinc-500">— ваша</span>}
                                    </p>
                                    <p className={`text-3xl font-bold ${style.scoreText}`}>
                                        {team.score ?? 0}
                                    </p>
                                </div>

                                <div className={`h-px ${i === 0 ? "bg-red-500/30" : "bg-blue-500/30"}`} />

                                <ul className="flex flex-col gap-1 p-2">
                                    {team.members?.map((m) => {
                                        const isMe = m.userId === userId;
                                        const status = roundStatuses[m.userId];
                                        return (
                                            <li
                                                key={m.userId}
                                                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm ${
                                                    isMe ? "bg-zinc-700/60 ring-1 ring-zinc-500" : "bg-zinc-800/40"
                                                }`}
                                            >
                                                <span className={`truncate ${isMe ? "font-semibold text-zinc-100" : "text-zinc-300"}`}>
                                                    {m.name}
                                                    {isMe && <span className="ml-1 text-xs text-zinc-500 font-normal">(вы)</span>}
                                                </span>
                                                {round ? (
                                                    status?.answered ? (
                                                        <span className={`shrink-0 text-xs font-bold ${status.isCorrect ? "text-green-400" : "text-red-400"}`}>
                                                            {status.isCorrect ? `+${status.delta}` : "✗"}
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0 text-base animate-pulse">❓</span>
                                                    )
                                                ) : (
                                                    <span className="shrink-0 text-xs text-zinc-500 font-mono">
                                                        {m.score ?? 0}
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {round ? (
                    <div className="flex flex-col items-center gap-5 w-full max-w-2xl">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-zinc-400">
                                Раунд {round.roundNumber}/{room.maxRounds}
                            </span>
                            <span className={`font-mono font-bold text-lg ${timeLeft <= 3 ? "text-red-400 animate-pulse" : "text-zinc-200"}`}>
                                {timeLeft}с
                            </span>
                        </div>

                        <div className="flex h-36 w-36 items-center justify-center rounded-3xl border-2 border-indigo-500 bg-zinc-900 text-8xl font-mono font-bold select-none">
                            {round.symbol}
                        </div>

                        <p className="text-lg font-semibold text-zinc-200 text-center">
                            {round.rule.description}
                        </p>

                        {myTeamIndex === -1 ? (
                            <p className="text-sm text-zinc-500">Вы наблюдаете</p>
                        ) : !answered && timeLeft > 0 ? (
                            <div className="flex gap-4">
                                {round.rule.options.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() =>
                                            answerMutation.mutate({
                                                roomId,
                                                roundId: round.roundId,
                                                answer: opt,
                                            })
                                        }
                                        disabled={answerMutation.isPending}
                                        className="rounded-xl bg-zinc-800 border border-zinc-700 px-8 py-4 text-lg font-semibold hover:border-indigo-500 hover:bg-indigo-900/30 disabled:opacity-50 transition-all"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className={`rounded-xl px-8 py-4 text-lg font-semibold border ${
                                lastResult?.isCorrect
                                    ? "bg-green-900/40 border-green-600 text-green-300"
                                    : "bg-red-900/40 border-red-600 text-red-300"
                            }`}>
                                {lastResult?.isCorrect
                                    ? `✓ +${lastResult.playerDelta} очков`
                                    : "✗ Неверно — команда −5"}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-4 text-zinc-500 text-sm">
                        Ожидание следующего раунда…
                    </div>
                )}

            </main>
        );
    }

    const canStartGame = roomTeams.every(
        (team) => team.members && team.members.length > 0,
    );
    const teamsWithNoPlayers = roomTeams.filter(
        (team) => !team.members || team.members.length === 0,
    );

    return (
        <main className="flex flex-1 flex-col items-center gap-6 p-6">
            <div className="flex w-full max-w-2xl items-center justify-between">
                <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        Код комнаты
                    </p>
                    <p className="text-4xl font-mono font-bold tracking-widest text-indigo-400">
                        {room.code}
                    </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span>
                        {room.maxPlayersPerTeam} × {room.maxPlayersPerTeam}
                    </span>
                    <button
                        onClick={() =>
                            signOut().then(() => router.push("/login"))
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                        Выйти
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
                {roomTeams.map((team, i) => {
                    const style = TEAM_STYLE[i] ?? TEAM_STYLE[0];
                    const isFull =
                        (team.members?.length ?? 0) >=
                        (room.maxPlayersPerTeam ?? 0);
                    const isMine = myTeamIndex === i;

                    return (
                        <div
                            key={team.id}
                            className={`rounded-2xl border-2 ${style.border} ${style.bg} p-4 flex flex-col gap-3`}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className={`font-bold ${style.text}`}>
                                    {team.name}
                                </h2>
                                <span className="text-xs text-zinc-500">
                                    {team.members?.length ?? 0}/
                                    {room.maxPlayersPerTeam}
                                </span>
                            </div>

                            <ul className="flex flex-col gap-1.5 min-h-[3rem]">
                                {team.members?.map((m) => (
                                    <li
                                        key={m.userId}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span
                                            className={`inline-block w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-red-400" : "bg-blue-400"}`}
                                        />
                                        <span
                                            className={
                                                m.userId === userId
                                                    ? "font-semibold text-zinc-100"
                                                    : "text-zinc-300"
                                            }
                                        >
                                            {m.name}
                                            {m.userId === userId && " (вы)"}
                                        </span>
                                    </li>
                                ))}
                                {(!team.members ||
                                    team.members.length === 0) && (
                                    <li className="text-xs text-zinc-600 italic">
                                        Пока пусто
                                    </li>
                                )}
                            </ul>

                            {!isMine && !isFull && (
                                <button
                                    onClick={() =>
                                        chooseTeam.mutate({
                                            roomId,
                                            teamIndex: i as 0 | 1,
                                        })
                                    }
                                    disabled={chooseTeam.isPending}
                                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${style.btn}`}
                                >
                                    Выбрать эту команду
                                </button>
                            )}
                            {isMine && (
                                <span
                                    className={`text-xs ${style.text} text-center`}
                                >
                                    ← Ваша команда
                                </span>
                            )}
                            {!isMine && isFull && (
                                <span className="text-xs text-zinc-600 text-center">
                                    Команда заполнена
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="w-full max-w-2xl rounded-2xl border border-zinc-600 bg-zinc-800/40 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-300">
                            Наблюдатели
                        </span>
                        {(room.spectators ?? []).length === 0 ? (
                            <span className="text-xs text-zinc-600 italic">пока никого</span>
                        ) : (
                            (room.spectators ?? []).map((s) => (
                                <span
                                    key={s.userId}
                                    className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300"
                                >
                                    {s.name}
                                </span>
                            ))
                        )}
                    </div>
                    {myTeamIndex !== -1 && (
                        <button
                            onClick={() => spectateMutation.mutate({ roomId })}
                            disabled={spectateMutation.isPending}
                            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors"
                        >
                            Наблюдать
                        </button>
                    )}
                </div>
            </div>

            {isHost && (
                <div className="flex items-center gap-3 mt-2">
                    <button
                        onClick={handleAddBot}
                        disabled={addBot.isPending}
                        className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500 disabled:opacity-50 transition-colors"
                    >
                        {addBot.isPending ? "…" : "+ Добавить бота"}
                    </button>
                    <button
                        onClick={() => startGame.mutate({ roomId })}
                        disabled={startGame.isPending || !canStartGame}
                        className="rounded-xl bg-indigo-600 px-7 py-2.5 font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {startGame.isPending ? "Запуск…" : "Начать игру"}
                    </button>
                </div>
            )}

            {!isHost && (
                <p className="text-sm text-zinc-500">Ожидание хоста…</p>
            )}
            {startGame.error && (
                <p className="text-sm text-red-400">
                    {startGame.error.message}
                </p>
            )}

            {isHost && !canStartGame && (
                <p className="text-sm text-red-400">
                    Нельзя начать игру:{" "}
                    {teamsWithNoPlayers.map((t) => t.name).join(", ")}{" "}
                    {teamsWithNoPlayers.length === 1 ? "пуста" : "пусты"}
                </p>
            )}
        </main>
    );
}
