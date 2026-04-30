import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { Navbar } from "./components/Navbar";

export const metadata: Metadata = {
    title: "TaskSwitcher — командный тренажёр",
    description: "Тренажёр переключения задач для команд",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru" className="h-full dark">
            <body
                className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 antialiased"
                style={{
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
            >
                <TRPCProvider>
                    <Navbar />
                    {children}
                </TRPCProvider>
            </body>
        </html>
    );
}
