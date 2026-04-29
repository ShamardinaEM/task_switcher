import { db } from "../server/db/seed";
import * as schema from "../server/db/schema";
import crypto from "crypto";

// Генерация пароля (для better-auth нужен хеш)
async function hashPassword(password: string): Promise<string> {
    // Используем crypto для простого хеша (better-auth сам обработает)
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
        .pbkdf2Sync(password, salt, 1000, 64, "sha512")
        .toString("hex");
    return `${salt}:${hash}`;
}

const PLAYERS = [
    { name: "Игрок_Анна", email: "anna@test.com", password: "123456" },
    { name: "Игрок_Борис", email: "boris@test.com", password: "123456" },
    { name: "Игрок_Вика", email: "vika@test.com", password: "123456" },
    { name: "Игрок_Глеб", email: "gleb@test.com", password: "123456" },
    { name: "Игрок_Диана", email: "diana@test.com", password: "123456" },
];

const ROUND_SYMBOLS = ["∑", "∫", "√", "∞", "π", "Δ", "Ω", "α", "β", "γ"];

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
    console.log("🌱 Начинаем заполнение БД...");

    // 1. Создаём пользователей
    const userIds: string[] = [];
    for (const p of PLAYERS) {
        const id = crypto.randomUUID();
        const hashed = await hashPassword(p.password);

        await db.insert(schema.users).values({
            id,
            name: p.name,
            email: p.email,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Создаём аккаунт для better-auth (credentials)
        await db.insert(schema.accounts).values({
            id: crypto.randomUUID(),
            accountId: id,
            providerId: "credential",
            userId: id,
            password: hashed,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        userIds.push(id);
        console.log(`  👤 ${p.name} (${p.email}) / ${p.password}`);
    }

    // 2. Создаём 5 матчей
    for (let matchNum = 1; matchNum <= 5; matchNum++) {
        const matchId = crypto.randomUUID();
        const code = Array.from({ length: 6 }, () =>
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(randomInt(0, 30)),
        ).join("");

        const teamRedId = crypto.randomUUID();
        const teamBlueId = crypto.randomUUID();

        // Команды
        await db.insert(schema.teams).values([
            {
                id: teamRedId,
                name: `Команда Red #${matchNum}`,
                createdAt: new Date(),
            },
            {
                id: teamBlueId,
                name: `Команда Blue #${matchNum}`,
                createdAt: new Date(),
            },
        ]);

        // Матч
        const startedAt = new Date(Date.now() - randomInt(1, 7) * 86400000);
        const endedAt = new Date(
            startedAt.getTime() + randomInt(300, 600) * 1000,
        );

        await db.insert(schema.matches).values({
            id: matchId,
            roomCode: code,
            status: "finished",
            startedAt,
            endedAt,
            createdAt: startedAt,
            winningTeamId: Math.random() > 0.5 ? teamRedId : teamBlueId,
        });

        // MatchTeams
        const redScore = randomInt(150, 300);
        const blueScore = randomInt(150, 300);

        await db.insert(schema.matchTeams).values([
            {
                id: crypto.randomUUID(),
                matchId,
                teamId: teamRedId,
                totalScore: redScore,
            },
            {
                id: crypto.randomUUID(),
                matchId,
                teamId: teamBlueId,
                totalScore: blueScore,
            },
        ]);

        // Выбираем 4 случайных игроков для этого матча
        const shuffled = [...userIds].sort(() => Math.random() - 0.5);
        const redPlayers = shuffled.slice(0, 2);
        const bluePlayers = shuffled.slice(2, 4);

        // Участники
        for (const uid of redPlayers) {
            const score = randomInt(50, 150);
            const correct = randomInt(5, 10);
            const wrong = randomInt(0, 5);
            await db.insert(schema.participants).values({
                id: crypto.randomUUID(),
                matchId,
                userId: uid,
                teamId: teamRedId,
                score,
                correct,
                wrong,
                isBot: false,
            });
        }

        // Добавляем ботов
        for (let b = 0; b < 2; b++) {
            const botId = `bot-${crypto.randomUUID()}`;
            await db.insert(schema.users).values({
                id: botId,
                name: "🤖 Бот",
                email: `${botId}@bot.local`,
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const botTeam = b < 1 ? teamRedId : teamBlueId;
            await db.insert(schema.participants).values({
                id: crypto.randomUUID(),
                matchId,
                userId: botId,
                teamId: botTeam,
                score: randomInt(30, 120),
                correct: randomInt(3, 9),
                wrong: randomInt(1, 6),
                isBot: true,
            });
        }

        for (const uid of bluePlayers) {
            const score = randomInt(50, 150);
            const correct = randomInt(5, 10);
            const wrong = randomInt(0, 5);
            await db.insert(schema.participants).values({
                id: crypto.randomUUID(),
                matchId,
                userId: uid,
                teamId: teamBlueId,
                score,
                correct,
                wrong,
                isBot: false,
            });
        }

        // Раунды
        const totalRounds = randomInt(8, 10);
        for (let r = 1; r <= totalRounds; r++) {
            const roundId = crypto.randomUUID();
            const useDigit = Math.random() < 0.5;
            let correctAnswer: string;
            let ruleDescription: string;
            let options: string[];
            let symbol: string;
            if (useDigit) {
                symbol = String(Math.floor(Math.random() * 9) + 1);
                const digit = parseInt(symbol);
                if (Math.random() < 0.5) {
                    options = ["чётное", "нечётное"];
                    correctAnswer = digit % 2 === 0 ? "чётное" : "нечётное";
                    ruleDescription = "Число чётное или нечётное?";
                } else {
                    options = ["больше 5", "не больше 5"];
                    correctAnswer = digit > 5 ? "больше 5" : "не больше 5";
                    ruleDescription = "Число больше 5 или нет?";
                }
            } else {
                const letters = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
                symbol = letters[Math.floor(Math.random() * letters.length)];
                const vowels = new Set([
                    "А",
                    "Е",
                    "Ё",
                    "И",
                    "О",
                    "У",
                    "Ы",
                    "Э",
                    "Ю",
                    "Я",
                ]);
                options = ["гласная", "согласная"];
                correctAnswer = vowels.has(symbol) ? "гласная" : "согласная";
                ruleDescription = "Буква гласная или согласная?";
            }

            const roundStartedAt = new Date(startedAt.getTime() + r * 15000);

            await db.insert(schema.rounds).values({
                id: roundId,
                matchId,
                symbol,
                rule: JSON.stringify({
                    type: useDigit
                        ? options[0] === "чётное" || options[0] === "нечётное"
                            ? "even-odd"
                            : "greater-less"
                        : "vowel-consonant",
                    description: ruleDescription,
                    options,
                }),
                correctAnswer,
                startedAt: roundStartedAt,
                endedAt: new Date(roundStartedAt.getTime() + 10000),
            });
        }

        console.log(
            `  🎮 Матч #${matchNum}: ${code} | Red: ${redScore} | Blue: ${blueScore}`,
        );
    }

    console.log("✅ Готово! Данные для входа:");
    console.log("   email: anna@test.com");
    console.log("   пароль: 123456");
}

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
