import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Task<span className="text-indigo-400">Switcher</span>
      </h1>
      <p className="max-w-md text-lg text-zinc-400">
        Командный тренажёр переключения задач. Классифицируй символы быстрее соперников
        и приведи свою команду к победе.
      </p>
      <div className="flex gap-4">
        <Link
          href="/lobby"
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500 transition-colors"
        >
          Играть
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold hover:border-zinc-500 transition-colors"
        >
          Рейтинг
        </Link>
      </div>
    </main>
  );
}
