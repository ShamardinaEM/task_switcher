"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { useEffect } from "react";

export default function LobbyPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [code, setCode] = useState("");
    const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState<2 | 3>(2);
    const [error, setError] = useState("");

    const cleanup = trpc.rooms.cleanup.useMutation();
    const createRoom = trpc.rooms.create.useMutation({
        onSuccess: (data) => router.push(`/game/${data.roomId}`),
        onError: (e) => setError(e.message),
    });

    const joinRoom = trpc.rooms.join.useMutation({
        onSuccess: (data) => router.push(`/game/${data.roomId}`),
        onError: (e) => setError(e.message),
    });

    useEffect(() => {
        cleanup.mutate();
    }, []);
    
    if (!session) {
        return (
            <main className="flex flex-1 items-center justify-center">
                <div className="text-center flex flex-col gap-4">
                    <p className="text-zinc-400">
                        Для игры нужно войти в аккаунт
                    </p>
                    <Link
                        href="/login"
                        className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500 transition-colors"
                    >
                        Войти
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-1 flex-col items-center gap-8 p-8">
            {/* Шапка */}
            <div className="w-full max-w-lg">
                <h1 className="text-3xl font-bold">Лобби</h1>
                <p className="text-zinc-400 text-sm">
                    Привет, {session.user.name}!
                </p>
            </div>

            {error && (
                <p className="w-full max-w-lg rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-300">
                    {error}
                </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
                {/* Создать комнату */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-4">
                    <h2 className="text-xl font-semibold">Создать комнату</h2>
                    <p className="text-sm text-zinc-400">
                        Вы станете хостом и получите 6-значный код для других
                        игроков
                    </p>

                    {/* Размер группы */}
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">
                            Размер команд
                        </p>
                        <div className="flex gap-2">
                            {([2, 3] as const).map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setMaxPlayersPerTeam(n)}
                                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                                        maxPlayersPerTeam === n
                                            ? "border-indigo-500 bg-indigo-900/40 text-indigo-300"
                                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                                    }`}
                                >
                                    {n} × {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => createRoom.mutate({ maxPlayersPerTeam })}
                        disabled={createRoom.isPending}
                        className="mt-auto rounded-xl bg-indigo-600 py-2.5 font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {createRoom.isPending ? "Создание…" : "Создать"}
                    </button>
                </div>

                {/* Войти по коду */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-4">
                    <h2 className="text-xl font-semibold">Войти по коду</h2>
                    <p className="text-sm text-zinc-400">
                        Введите код от хоста
                    </p>
                    <input
                        type="text"
                        placeholder="ABCD12"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-center text-2xl font-mono tracking-[0.3em] text-zinc-100 focus:outline-none focus:border-indigo-500 uppercase"
                    />
                    <button
                        onClick={() => joinRoom.mutate({ code })}
                        disabled={joinRoom.isPending || code.length < 6}
                        className="rounded-xl bg-zinc-700 py-2.5 font-semibold hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                    >
                        {joinRoom.isPending ? "Подключение…" : "Войти"}
                    </button>
                </div>
            </div>

            {/* Правила игры */}
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-lg font-semibold mb-4">📖 Правила игры</h2>
                <div className="flex flex-col gap-3 text-sm text-zinc-400">
                    <div className="flex gap-3">
                        <span className="text-xl shrink-0">👥</span>
                        <p>
                            Две команды по{" "}
                            <strong className="text-zinc-200">
                                2 или 3 игрока
                            </strong>
                            . Можно добавить ботов, чтобы заполнить состав.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <span className="text-xl shrink-0">🔤</span>
                        <p>
                            В каждом раунде на экране появляется{" "}
                            <strong className="text-zinc-200">символ</strong> —
                            буква или цифра — и{" "}
                            <strong className="text-zinc-200">правило</strong>:
                            например, «гласная или согласная?» или «чётное или
                            нечётное?».
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <span className="text-xl shrink-0">⚡</span>
                        <p>
                            На ответ есть{" "}
                            <strong className="text-zinc-200">8 секунд</strong>.
                            Чем быстрее — тем больше бонусных очков (до +5).
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <span className="text-xl shrink-0">🏆</span>
                        <div>
                            <p className="mb-1">Система очков:</p>
                            <ul className="flex flex-col gap-1 pl-2">
                                <li className="text-green-400">
                                    ✓ Правильный ответ —{" "}
                                    <strong>+10 очков</strong> игроку и команде
                                    (+ бонус за скорость)
                                </li>
                                <li className="text-red-400">
                                    ✗ Неправильный ответ —{" "}
                                    <strong>−5 очков</strong> команде
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <span className="text-xl shrink-0">🎯</span>
                        <p>
                            Матч состоит из{" "}
                            <strong className="text-zinc-200">
                                10 раундов
                            </strong>
                            . Побеждает команда с наибольшим счётом в конце.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
