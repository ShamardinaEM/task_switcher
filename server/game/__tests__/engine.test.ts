import { describe, it, expect } from 'vitest';
import {
  generateRound,
  checkAnswer,
  calcScoreDelta,
  isEven,
  isGreaterThan5,
  isVowel,
  ROUND_DURATION_MS,
  POINTS_CORRECT,
  POINTS_WRONG_TEAM,
} from '../engine';

// ─── Вспомогательные чистые функции ─────────────────────────────────────────

describe('isEven', () => {
  it('возвращает true для чётных чисел', () => {
    expect(isEven(2)).toBe(true);
    expect(isEven(4)).toBe(true);
    expect(isEven(8)).toBe(true);
  });

  it('возвращает false для нечётных чисел', () => {
    expect(isEven(1)).toBe(false);
    expect(isEven(3)).toBe(false);
    expect(isEven(9)).toBe(false);
  });
});

describe('isGreaterThan5', () => {
  it('возвращает true для чисел > 5', () => {
    expect(isGreaterThan5(6)).toBe(true);
    expect(isGreaterThan5(9)).toBe(true);
  });

  it('возвращает false для чисел ≤ 5', () => {
    expect(isGreaterThan5(5)).toBe(false);
    expect(isGreaterThan5(1)).toBe(false);
  });
});

describe('isVowel', () => {
  it('определяет гласные буквы (кириллица)', () => {
    expect(isVowel('А')).toBe(true); // Cyrillic А
    expect(isVowel('Е')).toBe(true); // Cyrillic Е
    expect(isVowel('я')).toBe(true); // строчная
  });

  it('определяет согласные буквы (кириллица)', () => {
    expect(isVowel('Б')).toBe(false);
    expect(isVowel('К')).toBe(false);
  });
});

// ─── Генерация раунда ─────────────────────────────────────────────────────────

describe('generateRound', () => {
  it('возвращает объект с нужными полями', () => {
    const round = generateRound('test-id');
    expect(round.id).toBe('test-id');
    expect(round.symbol).toBeTruthy();
    expect(round.rule).toBeDefined();
    expect(round.correctAnswer).toBeTruthy();
    expect(round.durationMs).toBe(ROUND_DURATION_MS);
    expect(round.startedAt).toBeTypeOf('number');
  });

  it('символ является цифрой или кириллической буквой', () => {
    for (let i = 0; i < 20; i++) {
      const round = generateRound('id');
      const isDigit = /^[1-9]$/.test(round.symbol);
      const isLetter = /^[А-ЯЁ]$/.test(round.symbol);
      expect(isDigit || isLetter).toBe(true);
    }
  });

  it('правильный ответ входит в список вариантов', () => {
    for (let i = 0; i < 20; i++) {
      const round = generateRound('id');
      expect(round.rule.options).toContain(round.correctAnswer);
    }
  });
});

// ─── Проверка ответа ──────────────────────────────────────────────────────────

describe('checkAnswer', () => {
  it('возвращает true при совпадении с правильным ответом', () => {
    const round = generateRound('id');
    expect(checkAnswer(round, round.correctAnswer)).toBe(true);
  });

  it('возвращает false при неверном ответе', () => {
    const round = generateRound('id');
    const wrongAnswer = round.rule.options.find((o) => o !== round.correctAnswer)!;
    expect(checkAnswer(round, wrongAnswer)).toBe(false);
  });
});

// ─── Подсчёт очков ────────────────────────────────────────────────────────────

describe('calcScoreDelta', () => {
  it('при верном ответе даёт положительные очки', () => {
    const { playerDelta, teamDelta } = calcScoreDelta(true, 2000);
    expect(playerDelta).toBeGreaterThanOrEqual(POINTS_CORRECT);
    expect(teamDelta).toBe(playerDelta);
  });

  it('при неверном ответе командный счёт уменьшается', () => {
    const { playerDelta, teamDelta } = calcScoreDelta(false, 2000);
    expect(playerDelta).toBe(0);
    expect(teamDelta).toBe(POINTS_WRONG_TEAM);
  });

  it('быстрый ответ даёт больше очков, чем медленный', () => {
    const fast = calcScoreDelta(true, 500);
    const slow = calcScoreDelta(true, 7500);
    expect(fast.playerDelta).toBeGreaterThan(slow.playerDelta);
  });
});

