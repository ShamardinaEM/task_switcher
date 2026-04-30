"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

type Tab = "players" | "teams" | "winrate";

export default function LeaderboardPage() {
    const [tab, setTab] = useState<Tab>("players");

    const playersQuery = trpc.leaderboard.players.useQuery();
    const teamsQuery = trpc.leaderboard.teams.useQuery();
    const winrateQuery = trpc.leaderboard.teamsAggregated.useQuery();
    return (
        <main className="flex flex-1 flex-col items-center gap-8 p-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-2">Рейтинг</h1>
                <p className="text-zinc-400 text-sm">
                    Обновляется после каждого матча
                </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1 w-fit">
                <TabBtn
                    active={tab === "players"}
                    onClick={() => setTab("players")}
                >
                    Рейтинг игроков
                </TabBtn>
                <TabBtn
                    active={tab === "teams"}
                    onClick={() => setTab("teams")}
                >
                    Рейтинг команд
                </TabBtn>
                <TabBtn
                    active={tab === "winrate"}
                    onClick={() => setTab("winrate")}
                >
                    Винрейт команд
                </TabBtn>
            </div>

            <div className="w-full max-w-3xl">
                {tab === "players" && (
                    <PlayersTab
                        data={playersQuery.data}
                        isLoading={playersQuery.isLoading}
                    />
                )}
                {tab === "teams" && (
                    <TeamsTab
                        data={teamsQuery.data}
                        isLoading={teamsQuery.isLoading}
                    />
                )}
                {tab === "winrate" && (
                    <WinrateTab
                        data={winrateQuery.data}
                        isLoading={winrateQuery.isLoading}
                    />
                )}
            </div>

            <Link
                href="/lobby"
                className="text-sm text-indigo-400 hover:underline"
            >
                ← Назад в лобби
            </Link>
        </main>
    );
}

function TabBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
            {children}
        </button>
    );
}

/* ─── Players tab ──────────────────────────────────────────────── */

type Player = {
    userId: string;
    name: string;
    totalScore: number;
    totalCorrect: number;
    totalWrong: number;
    matchesPlayed: number;
};

function PlayersTab({
    data,
    isLoading,
}: {
    data?: Player[];
    isLoading: boolean;
}) {
    if (isLoading) return <Skeleton />;

    if (!data || data.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="divide-y divide-zinc-800">
                {data.map((player, i) => {
                    const accuracy =
                        player.totalCorrect + player.totalWrong > 0
                            ? Math.round(
                                  (player.totalCorrect /
                                      (player.totalCorrect +
                                          player.totalWrong)) *
                                      100,
                              )
                            : 0;

                    return (
                        <div
                            key={player.userId}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/40 transition-colors"
                        >
                            <div className="w-8 text-center font-bold text-zinc-500 shrink-0">
                                {i === 0
                                    ? "🥇"
                                    : i === 1
                                      ? "🥈"
                                      : i === 2
                                        ? "🥉"
                                        : `#${i + 1}`}
                            </div>

                            <div className="w-9 h-9 rounded-full bg-indigo-900/50 flex items-center justify-center text-sm font-bold shrink-0">
                                {player.name[0]}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">
                                    {player.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {player.matchesPlayed}{" "}
                                    {plural(
                                        player.matchesPlayed,
                                        "матч",
                                        "матча",
                                        "матчей",
                                    )}{" "}
                                    · точность {accuracy}%
                                </p>
                            </div>

                            <div className="flex items-center gap-5 text-sm shrink-0">
                                <div className="text-center hidden sm:block">
                                    <p className="text-green-400 font-medium">
                                        {player.totalCorrect}✓
                                    </p>
                                    <p className="text-red-400 font-medium">
                                        {player.totalWrong}✗
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-indigo-400">
                                        {player.totalScore}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        очков
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Teams tab ──────────────────────────────────────── */

type TeamMember = {
    id: string;
    name: string;
    score: number;
    correct: number;
    wrong: number;
    isBot: boolean;
};

type Team = {
    id: string;
    name: string;
    totalScore: number;
    wins: number;
    matchesPlayed: number;
    members: TeamMember[];
};

function TeamsTab({ data, isLoading }: { data?: Team[]; isLoading: boolean }) {
    if (isLoading) return <Skeleton />;

    if (!data || data.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="divide-y divide-zinc-800">
                {data.map((team, i) => (
                    <div
                        key={team.id}
                        className="p-6 hover:bg-zinc-800/40 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                                <div className="text-2xl font-bold text-zinc-500">
                                    {i === 0
                                        ? "🥇"
                                        : i === 1
                                          ? "🥈"
                                          : i === 2
                                            ? "🥉"
                                            : `#${i + 1}`}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">
                                        {team.name}
                                    </h2>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-indigo-400">
                                    {team.totalScore}
                                </div>
                                <p className="text-xs text-zinc-500">
                                    суммарно очков
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                            {team.members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center gap-3 bg-zinc-800/50 rounded-lg p-2"
                                >
                                    <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-sm">
                                        {member.isBot ? "🤖" : member.name[0]}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {member.name}
                                        </p>
                                        <div className="flex gap-3 text-xs text-zinc-500">
                                            <span>✓ {member.correct}</span>
                                            <span>✗ {member.wrong}</span>
                                            <span>⭐ {member.score}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Winrate tab ──────────────────────────────────────── */

type AggregatedTeam = {
    id: string;
    name: string;
    totalScore: number;
    wins: number;
    matchesPlayed: number;
    members: any[];
};

function WinrateTab({
    data,
    isLoading,
}: {
    data?: AggregatedTeam[];
    isLoading: boolean;
}) {
    if (isLoading) return <Skeleton />;
    if (!data || data.length === 0) return <EmptyState />;

    const redTeams = data.filter((t) => t.name.includes("Red"));
    const blueTeams = data.filter((t) => t.name.includes("Blue"));

    const redTotalMatches = redTeams.reduce(
        (sum, t) => sum + t.matchesPlayed,
        0,
    );
    const redTotalWins = redTeams.reduce((sum, t) => sum + t.wins, 0);
    const blueTotalMatches = blueTeams.reduce(
        (sum, t) => sum + t.matchesPlayed,
        0,
    );
    const blueTotalWins = blueTeams.reduce((sum, t) => sum + t.wins, 0);

    if (redTotalMatches === 0 && blueTotalMatches === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
                Нет завершённых матчей
            </div>
        );
    }

    const redWinrate =
        redTotalMatches > 0
            ? Math.round((redTotalWins / redTotalMatches) * 100)
            : 0;
    const blueWinrate =
        blueTotalMatches > 0
            ? Math.round((blueTotalWins / blueTotalMatches) * 100)
            : 0;

    const totalWinrate = redWinrate + blueWinrate;
    const redWidth = totalWinrate > 0 ? (redWinrate / totalWinrate) * 100 : 50;
    const blueWidth =
        totalWinrate > 0 ? (blueWinrate / totalWinrate) * 100 : 50;

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="flex h-32">
                <div
                    className="bg-red-600 flex items-center justify-center transition-all duration-500"
                    style={{ width: `${redWidth}%` }}
                >
                    <div className="text-center text-white">
                        <p className="font-bold text-lg">Команда Red</p>
                        <p className="text-3xl font-bold">{redWinrate}%</p>
                        <p className="text-sm opacity-80">
                            {redTotalWins} побед из {redTotalMatches}
                            {plural(
                                redTotalMatches,
                                " матча",
                                " матчей",
                                " матчей",
                            )}
                        </p>
                    </div>
                </div>
                <div
                    className="bg-blue-600 flex items-center justify-center transition-all duration-500"
                    style={{ width: `${blueWidth}%` }}
                >
                    <div className="text-center text-white">
                        <p className="font-bold text-lg">Команда Blue</p>
                        <p className="text-3xl font-bold">{blueWinrate}%</p>
                        <p className="text-sm opacity-80">
                            {blueTotalWins} побед из {blueTotalMatches}
                            {plural(
                                blueTotalMatches,
                                " матча",
                                " матчей",
                                " матчей",
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function Skeleton() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 animate-pulse">
            Загрузка…
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
            Рейтинг пока пуст — сыграйте первый матч!
        </div>
    );
}

function plural(n: number, one: string, few: string, many: string) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}
