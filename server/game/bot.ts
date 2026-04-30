// Намеренно не импортируем из store.ts — это предотвращает циклическую зависимость.
// store.ts → bot.ts → store.ts привело бы к тому, что submitAnswer был бы undefined
// при вызове. Вместо этого store передаёт себя как колбэк.

export type AnswerCallback = (opts: {
  roomId: string;
  roundId: string;
  userId: string;
  answer: string;
}) => Promise<unknown>;

interface BotOpts {
  roomId: string;
  roundId: string;
  userId: string;
  correctAnswer: string;
  accuracy: number;
  onAnswer: AnswerCallback;
}

export function scheduleBot(opts: BotOpts): void {
  const delayMs = 1000 + Math.random() * 4000;

  setTimeout(() => {
    const isCorrect = Math.random() < opts.accuracy;
    const answer = isCorrect ? opts.correctAnswer : pickWrongAnswer(opts.correctAnswer);
    void opts.onAnswer({
      roomId: opts.roomId,
      roundId: opts.roundId,
      userId: opts.userId,
      answer,
    });
  }, delayMs);
}

function pickWrongAnswer(correct: string): string {
  const pairs: Record<string, string> = {
    чётное: 'нечётное',
    нечётное: 'чётное',
    'больше 5': 'не больше 5',
    'не больше 5': 'больше 5',
    гласная: 'согласная',
    согласная: 'гласная',
  };
  return pairs[correct] ?? correct;
}
