export type RuleType = 'even-odd' | 'greater-less' | 'vowel-consonant';
export type SymbolKind = 'digit' | 'letter';

export interface GameRule {
  type: RuleType;
  description: string;
  options: [string, string];
}

export interface GameRound {
  id: string;
  symbol: string;
  symbolKind: SymbolKind;
  rule: GameRule;
  correctAnswer: string;
  startedAt: number;
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

export interface Spectator {
  userId: string;
  name: string;
}

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  teams: [TeamState, TeamState];
  spectators: Spectator[];
  maxPlayersPerTeam: number;
  currentRound: GameRound | null;
  roundNumber: number;
  maxRounds: number;
  answeredInRound: Set<string>;
  roundTimer: ReturnType<typeof setTimeout> | null;
}
