import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleBot } from '../bot';
import type { AnswerCallback } from '../bot';

// ─── Настройка фейковых таймеров ─────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Вспомогательные данные ───────────────────────────────────────────────────

const CORRECT_ANSWER = 'чётное';

const BASE_OPTS = {
  roomId: 'room-1',
  roundId: 'round-1',
  userId: 'bot-abc',
  correctAnswer: CORRECT_ANSWER,
};

// ─── scheduleBot ──────────────────────────────────────────────────────────────

describe('scheduleBot', () => {
  it('не вызывает onAnswer сразу', () => {
    const onAnswer = vi.fn<AnswerCallback>();
    scheduleBot({ ...BASE_OPTS, accuracy: 1, onAnswer });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('вызывает onAnswer через 1–5 секунд', async () => {
    const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
    scheduleBot({ ...BASE_OPTS, accuracy: 1, onAnswer });
    vi.advanceTimersByTime(999);
    expect(onAnswer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('передаёт корректные roomId и roundId в callback', async () => {
    const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
    scheduleBot({ ...BASE_OPTS, accuracy: 1, onAnswer });
    vi.runAllTimers();
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-1', roundId: 'round-1', userId: 'bot-abc' }),
    );
  });

  it('при accuracy=1 всегда отвечает правильно', () => {
    const answers: string[] = [];
    for (let i = 0; i < 10; i++) {
      const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
      scheduleBot({ ...BASE_OPTS, accuracy: 1, onAnswer });
      vi.runAllTimers();
      const call = onAnswer.mock.calls[0]?.[0];
      if (call) answers.push(call.answer);
    }
    expect(answers.every((a) => a === CORRECT_ANSWER)).toBe(true);
  });

  it('при accuracy=0 всегда отвечает неправильно', () => {
    const answers: string[] = [];
    for (let i = 0; i < 10; i++) {
      const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
      scheduleBot({ ...BASE_OPTS, accuracy: 0, onAnswer });
      vi.runAllTimers();
      const call = onAnswer.mock.calls[0]?.[0];
      if (call) answers.push(call.answer);
    }
    expect(answers.every((a) => a !== CORRECT_ANSWER)).toBe(true);
  });

  it('неправильный ответ — противоположный вариант (не пустой)', () => {
    const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
    scheduleBot({ ...BASE_OPTS, accuracy: 0, onAnswer });
    vi.runAllTimers();
    const call = onAnswer.mock.calls[0]?.[0];
    expect(call?.answer).toBe('нечётное'); 
  });

  it('все варианты ответов — проверка пар инверсий', () => {
    const pairs: Array<[string, string]> = [
      ['чётное', 'нечётное'],
      ['нечётное', 'чётное'],
      ['больше 5', 'не больше 5'],
      ['не больше 5', 'больше 5'],
      ['гласная', 'согласная'],
      ['согласная', 'гласная'],
    ];

    for (const [correct, expectedWrong] of pairs) {
      const onAnswer = vi.fn<AnswerCallback>().mockResolvedValue(undefined);
      scheduleBot({ ...BASE_OPTS, correctAnswer: correct, accuracy: 0, onAnswer });
      vi.runAllTimers();
      const call = onAnswer.mock.calls[0]?.[0];
      expect(call?.answer).toBe(expectedWrong);
    }
  });
});
