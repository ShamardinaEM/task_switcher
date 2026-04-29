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
} from '../engine';

// ─── isVowel — русские буквы ──────────────────────────────────────────────────

describe('isVowel (кириллица)', () => {
  const VOWELS = ['А', 'Е', 'Ё', 'И', 'О', 'У', 'Ы', 'Э', 'Ю', 'Я'];
  const CONSONANTS = ['Б', 'В', 'Г', 'Д', 'Ж', 'З', 'Й', 'К', 'Л', 'М', 'Н'];

  it('все русские гласные определяются верно', () => {
    for (const letter of VOWELS) {
      expect(isVowel(letter)).toBe(true);
    }
  });

  it('все проверяемые согласные определяются верно', () => {
    for (const letter of CONSONANTS) {
      expect(isVowel(letter)).toBe(false);
    }
  });

  it('регистр не влияет на результат (строчные гласные)', () => {
    expect(isVowel('а')).toBe(true);
    expect(isVowel('е')).toBe(true);
    expect(isVowel('я')).toBe(true);
  });
});

// ─── isEven — граничные значения ─────────────────────────────────────────────

describe('isEven — граничные значения', () => {
  it('все чётные цифры 1–9 определяются верно', () => {
    [2, 4, 6, 8].forEach((n) => expect(isEven(n)).toBe(true));
  });

  it('все нечётные цифры 1–9 определяются верно', () => {
    [1, 3, 5, 7, 9].forEach((n) => expect(isEven(n)).toBe(false));
  });
});

// ─── isGreaterThan5 — граничные значения ─────────────────────────────────────

describe('isGreaterThan5 — граничные значения', () => {
  it('ровно 5 — не больше 5', () => {
    expect(isGreaterThan5(5)).toBe(false);
  });

  it('6 — больше 5', () => {
    expect(isGreaterThan5(6)).toBe(true);
  });

  it('1 — не больше 5, 9 — больше 5', () => {
    expect(isGreaterThan5(1)).toBe(false);
    expect(isGreaterThan5(9)).toBe(true);
  });
});

// ─── generateRound — соответствие символа и правила ─────────────────────────

describe('generateRound — соответствие символа и правила', () => {
  it('для цифры правило относится к числам', () => {
    const digitRuleTypes = new Set(['even-odd', 'greater-less']);
    // Проверяем 50 раундов, чтобы поймать оба типа
    let digitRoundFound = false;
    for (let i = 0; i < 50; i++) {
      const round = generateRound(`id-${i}`);
      if (round.symbolKind === 'digit') {
        digitRoundFound = true;
        expect(digitRuleTypes.has(round.rule.type)).toBe(true);
        expect(/^[1-9]$/.test(round.symbol)).toBe(true);
      }
    }
    expect(digitRoundFound).toBe(true);
  });

  it('для буквы правило vowel-consonant', () => {
    let letterRoundFound = false;
    for (let i = 0; i < 50; i++) {
      const round = generateRound(`id-${i}`);
      if (round.symbolKind === 'letter') {
        letterRoundFound = true;
        expect(round.rule.type).toBe('vowel-consonant');
        // Буква — кириллица
        expect(/^[А-ЯЁ]$/.test(round.symbol)).toBe(true);
      }
    }
    expect(letterRoundFound).toBe(true);
  });

  it('correctAnswer всегда совпадает с одним из двух вариантов', () => {
    for (let i = 0; i < 30; i++) {
      const round = generateRound(`id-${i}`);
      const [a, b] = round.rule.options;
      expect(round.correctAnswer === a || round.correctAnswer === b).toBe(true);
    }
  });
});

// ─── checkAnswer — конкретные правила ─────────────────────────────────────────

describe('checkAnswer — конкретные правила', () => {
  it('чётная цифра → ответ "чётное"', () => {
    // Генерируем раунды, пока не получим even-odd с чётным символом
    for (let i = 0; i < 100; i++) {
      const round = generateRound(`id-${i}`);
      if (round.rule.type === 'even-odd' && parseInt(round.symbol) % 2 === 0) {
        expect(checkAnswer(round, 'чётное')).toBe(true);
        expect(checkAnswer(round, 'нечётное')).toBe(false);
        return;
      }
    }
  });

  it('буква А — гласная', () => {
    for (let i = 0; i < 100; i++) {
      const round = generateRound(`id-${i}`);
      if (round.rule.type === 'vowel-consonant' && round.symbol === 'А') {
        expect(checkAnswer(round, 'гласная')).toBe(true);
        expect(checkAnswer(round, 'согласная')).toBe(false);
        return;
      }
    }
  });

  it('9 — больше 5', () => {
    for (let i = 0; i < 100; i++) {
      const round = generateRound(`id-${i}`);
      if (round.rule.type === 'greater-less' && round.symbol === '9') {
        expect(checkAnswer(round, 'больше 5')).toBe(true);
        expect(checkAnswer(round, 'не больше 5')).toBe(false);
        return;
      }
    }
  });
});

// ─── calcScoreDelta — скоростной бонус ───────────────────────────────────────

describe('calcScoreDelta — скоростной бонус', () => {
  it('мгновенный ответ (0 мс) даёт максимальный бонус +5', () => {
    const { playerDelta } = calcScoreDelta(true, 0);
    expect(playerDelta).toBe(POINTS_CORRECT + 5);
  });

  it('ответ в конце времени (ROUND_DURATION_MS) — бонус 0', () => {
    const { playerDelta } = calcScoreDelta(true, ROUND_DURATION_MS);
    expect(playerDelta).toBe(POINTS_CORRECT);
  });

  it('неверный ответ — playerDelta всегда 0 независимо от скорости', () => {
    expect(calcScoreDelta(false, 0).playerDelta).toBe(0);
    expect(calcScoreDelta(false, 4000).playerDelta).toBe(0);
    expect(calcScoreDelta(false, ROUND_DURATION_MS).playerDelta).toBe(0);
  });

  it('teamDelta при верном ответе совпадает с playerDelta', () => {
    const { playerDelta, teamDelta } = calcScoreDelta(true, 3000);
    expect(teamDelta).toBe(playerDelta);
  });
});

