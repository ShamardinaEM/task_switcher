'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? 'Ошибка входа');
    } else {
      router.push('/lobby');
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col gap-5"
      >
        <h1 className="text-2xl font-bold text-center">Вход</h1>

        {error && (
          <p className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-600 py-2.5 font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Вход…' : 'Войти'}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-indigo-400 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </main>
  );
}
