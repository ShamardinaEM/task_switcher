import { serverTrpc } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth";

export default async function StatsPage() {
    try {
        const h = await headers();
        const session = await auth.api.getSession({ headers: h });

        if (!session) {
            redirect("/login");
        }

        const caller = await serverTrpc();
        const history = await caller.matches.myHistory();

        const finished = history.filter((m) => m.status === "finished");
        const wins = finished.filter((m) => m.won === true).length;
        const losses = finished.filter((m) => m.won === false).length;
        const totalScore = history.reduce((s, m) => s + m.score, 0);
        const totalCorrect = history.reduce((s, m) => s + m.correct, 0);
        const totalWrong = history.reduce((s, m) => s + m.wrong, 0);
        const accuracy =
            totalCorrect + totalWrong > 0
                ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
                : 0;

        return (
            <main className="flex flex-1 flex-col items-center gap-8 p-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-1">Статистика</h1>
                    <p className="text-zinc-400 text-sm">
                        История ваших матчей
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
                    <StatCard label="Матчей" value={finished.length} />
                    <StatCard
                        label="Побед"
                        value={wins}
                        color="text-green-400"
                    />
                    <StatCard
                        label="Поражений"
                        value={losses}
                        color="text-red-400"
                    />
                    <StatCard
                        label="Точность"
                        value={`${accuracy}%`}
                        color="text-indigo-400"
                    />
                    <StatCard label="Всего очков" value={totalScore} />
                    <StatCard
                        label="Правильных"
                        value={totalCorrect}
                        color="text-green-400"
                    />
                    <StatCard
                        label="Ошибок"
                        value={totalWrong}
                        color="text-red-400"
                    />
                    <StatCard
                        label="Лучший матч"
                        value={
                            history.length > 0
                                ? Math.max(...history.map((m) => m.score))
                                : 0
                        }
                        color="text-yellow-400"
                    />
                </div>

                <div className="w-full max-w-2xl">
                    <h2 className="text-lg font-semibold mb-3 text-zinc-300">
                        История матчей
                    </h2>

                    {history.length === 0 ? (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
                            Вы ещё не сыграли ни одного матча
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {history.map((match) => (
                                <li
                                    key={match.matchId}
                                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 flex items-center gap-4"
                                >
                                    <div className="w-14 text-center shrink-0">
                                        {match.status === "finished" ? (
                                            match.won ? (
                                                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-900/50 border border-green-700 text-green-300">
                                                    ПОБЕДА
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-900/50 border border-red-700 text-red-300">
                                                    ПОРАЖ.
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500">
                                                {match.status === "playing"
                                                    ? "ИДЁТ"
                                                    : "ОЖИД."}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm text-zinc-400">
                                                {match.roomCode}
                                            </span>
                                            <span className="text-zinc-600">
                                                ·
                                            </span>
                                            <span className="text-sm text-zinc-400">
                                                {match.teamName}
                                            </span>
                                        </div>
                                        {match.startedAt && (
                                            <p className="text-xs text-zinc-600 mt-0.5">
                                                {new Date(
                                                    match.startedAt,
                                                ).toLocaleString("ru-RU", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-5 text-sm shrink-0">
                                        <div className="text-center">
                                            <p className="font-bold text-indigo-400 text-lg leading-none">
                                                {match.score}
                                            </p>
                                            <p className="text-xs text-zinc-600 mt-0.5">
                                                очков
                                            </p>
                                        </div>
                                        <div className="text-center hidden sm:block">
                                            <p className="text-green-400 font-medium">
                                                {match.correct}✓
                                            </p>
                                            <p className="text-red-400 font-medium">
                                                {match.wrong}✗
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
        );
    } catch (error) {
        console.error("Error loading stats:", error);
        redirect("/login");
    }
}

function StatCard({
    label,
    value,
    color = "text-zinc-100",
}: {
    label: string;
    value: string | number;
    color?: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
        </div>
    );
}
