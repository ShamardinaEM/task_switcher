"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

export function Navbar() {
    const router = useRouter();
    const { data: session } = useSession();

    return (
        <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
                {/* Логотип */}
                <Link
                    href="/"
                    className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
                >
                    Task<span className="text-indigo-400">Switcher</span>
                </Link>

                {/* Навигация */}
                <nav className="flex items-center gap-1">
                    <NavLink href="/">Главное меню</NavLink>
                    <NavLink href="/lobby">Лобби</NavLink>
                    <NavLink href="/leaderboard">Рейтинг</NavLink>
                    {session && <NavLink href="/stats">Статистика</NavLink>}
                    {session && (
                        <div className="m-3 flex items-center gap-3">
                            {/* Аватар + имя */}
                            <div className="flex items-center gap-2">
                                {session.user.image ? (
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name}
                                        width={28}
                                        height={28}
                                        className="rounded-full grayscale"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                                        {session.user.name?.[0]?.toUpperCase() ??
                                            "?"}
                                    </div>
                                )}
                                <span className="text-sm text-zinc-300 font-medium hidden sm:block">
                                    {session.user.name}
                                </span>
                            </div>
                        </div>
                    )}
                    {session && (
                        <div>
                            {/* Кнопка выхода */}
                            <button
                                onClick={() =>
                                    signOut().then(() => router.push("/login"))
                                }
                                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                            >
                                Выйти
                            </button>
                        </div>
                    )}
                    {!session && <NavLink href="/login">Войти</NavLink>}
                </nav>
            </div>
        </header>
    );
}

function NavLink({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
            {children}
        </Link>
    );
}
