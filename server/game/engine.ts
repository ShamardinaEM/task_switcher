import type { GameRound, GameRule, SymbolKind } from "./types";

const VOWELS = new Set(["А", "Е", "Ё", "И", "О", "У", "Ы", "Э", "Ю", "Я"]);
const LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");
const PRIMES = new Set([2, 3, 5, 7]);

export const ROUND_DURATION_MS = 8000;
export const POINTS_CORRECT = 10;
export const POINTS_WRONG_TEAM = -5; // штраф для команды

// ─── Генерация символа ────────────────────────────────────────────────────────

function pickDigit(): string {
    return String(Math.floor(Math.random() * 9) + 1); // 1–9
}

function pickLetter(): string {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

// ─── Правила для цифр ─────────────────────────────────────────────────────────

function evenOddRule(digit: number): { rule: GameRule; correctAnswer: string } {
    const correctAnswer = digit % 2 === 0 ? "чётное" : "нечётное";
    return {
        rule: {
            type: "even-odd",
            description: "Число чётное или нечётное?",
            options: ["чётное", "нечётное"],
        },
        correctAnswer,
    };
}

function greaterLessRule(digit: number): {
    rule: GameRule;
    correctAnswer: string;
} {
    const correctAnswer = digit > 5 ? "больше 5" : "не больше 5";
    return {
        rule: {
            type: "greater-less",
            description: "Число больше 5 или нет?",
            options: ["больше 5", "не больше 5"],
        },
        correctAnswer,
    };
}

// ─── Правила для букв ─────────────────────────────────────────────────────────

function vowelConsonantRule(letter: string): {
    rule: GameRule;
    correctAnswer: string;
} {
    const correctAnswer = VOWELS.has(letter) ? "гласная" : "согласная";
    return {
        rule: {
            type: "vowel-consonant",
            description: "Буква гласная или согласная?",
            options: ["гласная", "согласная"],
        },
        correctAnswer,
    };
}

// ─── Генерация раунда ─────────────────────────────────────────────────────────

export function generateRound(id: string): GameRound {
    const useDigit = Math.random() < 0.5;
    const symbolKind: SymbolKind = useDigit ? "digit" : "letter";

    if (useDigit) {
        const symbol = pickDigit();
        const digit = parseInt(symbol, 10);
        const ruleVariants = [evenOddRule, greaterLessRule];
        const { rule, correctAnswer } =
            ruleVariants[Math.floor(Math.random() * ruleVariants.length)](
                digit,
            );
        return {
            id,
            symbol,
            symbolKind,
            rule,
            correctAnswer,
            startedAt: Date.now(),
            durationMs: ROUND_DURATION_MS,
        };
    } else {
        const symbol = pickLetter();
        const { rule, correctAnswer } = vowelConsonantRule(symbol);
        return {
            id,
            symbol,
            symbolKind,
            rule,
            correctAnswer,
            startedAt: Date.now(),
            durationMs: ROUND_DURATION_MS,
        };
    }
}

// ─── Проверка ответа ──────────────────────────────────────────────────────────

export function checkAnswer(round: GameRound, answer: string): boolean {
    return answer === round.correctAnswer;
}

// ─── Подсчёт очков ────────────────────────────────────────────────────────────

export interface ScoreDelta {
    playerDelta: number; // изменение личного счёта
    teamDelta: number; // изменение командного счёта
}

export function calcScoreDelta(
    isCorrect: boolean,
    responseMs: number,
): ScoreDelta {
    if (isCorrect) {
        // Бонус за скорость: максимум 5 дополнительных очков
        const speedBonus = Math.max(
            0,
            Math.floor((ROUND_DURATION_MS - responseMs) / 1600),
        );
        const playerDelta = POINTS_CORRECT + speedBonus;
        return { playerDelta, teamDelta: playerDelta };
    }
    return { playerDelta: 0, teamDelta: POINTS_WRONG_TEAM };
}

// ─── Вспомогательное: факты о числе (для тестов) ─────────────────────────────

export function isEven(n: number): boolean {
    return n % 2 === 0;
}

export function isGreaterThan5(n: number): boolean {
    return n > 5;
}

export function isVowel(letter: string): boolean {
    return VOWELS.has(letter.toUpperCase());
}
