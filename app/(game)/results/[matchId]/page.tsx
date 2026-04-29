import Link from 'next/link';
import { serverTrpc } from '@/lib/trpc/server';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const caller = await serverTrpc();
  const { match, participants } = await caller.matches.get({ matchId });

  const teamMap = new Map(match.matchTeams.map((mt) => [mt.teamId, mt]));

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Результаты матча</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {match.matchTeams.map((mt) => {
          const isWinner = mt.teamId === match.winningTeamId;
          const teamParticipants = participants.filter((p) => p.teamId === mt.teamId);
          return (
            <div
              key={mt.teamId}
              className={`rounded-2xl border p-6 ${
                isWinner
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                {isWinner && <span className="text-yellow-400">🏆</span>}
                <h2 className="font-bold text-lg">{mt.team.name}</h2>
                <span className="ml-auto text-2xl font-bold text-indigo-400">{mt.totalScore}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {teamParticipants.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{p.isBot ? '🤖 Бот' : p.user?.name ?? p.userId}</span>
                    <span className="text-zinc-400">
                      {p.correct}✓ {p.wrong}✗ · {p.score} очков
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Link
          href="/lobby"
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500"
        >
          Играть снова
        </Link>
        <Link href="/leaderboard" className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold hover:border-zinc-500">
          Рейтинг
        </Link>
      </div>
    </main>
  );
}
