export type RuleType = 'even-odd' | 'greater-less' | 'vowel-consonant';
export type SymbolKind = 'digit' | 'letter';

export interface GameRule {
  type: RuleType;
  description: string;
  options: [string, string]; // два варианта ответа
}

export interface GameRound {
  id: string;
  symbol: string;
  symbolKind: SymbolKind;
  rule: GameRule;
  correctAnswer: string;
  startedAt: number; // Date.now()
  durationMs: number;
}

export interface TeamState {
  id: string;
  name: string;
  members: RoomMember[];
  score: number;
}

export interface RoomMember {
  userId: string;
  name: string;
  isBot: boolean;
  score: number;
  correct: number;
  wrong: number;
}

export interface GameRoom {
  id: string; // matchId из БД
  code: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  teams: [TeamState, TeamState];
  maxPlayersPerTeam: number; // 2 (2v2) или 3 (3v3)
  currentRound: GameRound | null;
  roundNumber: number;
  maxRounds: number;
  answeredInRound: Set<string>; // userId-ы, уже ответившие в текущем раунде
  roundTimer: ReturnType<typeof setTimeout> | null;
}
