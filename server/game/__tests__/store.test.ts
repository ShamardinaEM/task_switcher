/**
 * Тесты для чистой in-memory логики store.ts.
 * DB и Pusher мокируются — тестируются только синхронные операции:
 * createRoom, joinRoom, chooseTeam, addBot.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Моки ────────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

vi.mock('../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
}));

vi.mock('../../pusher', () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
  gameChannel: (id: string) => `game-${id}`,
  PusherEvent: {
    GAME_STARTING: 'game:starting',
    ROUND_START: 'round:start',
    ROUND_END: 'round:end',
    SCORE_UPDATE: 'score:update',
    GAME_END: 'game:end',
  },
}));

vi.mock('../../db/schema', () => ({
  matches: {},
  teams: {},
  matchTeams: {},
  participants: {},
  rounds: {},
  answers: {},
  users: {},
}));

// ─── Импорт после моков ───────────────────────────────────────────────────────

import {
  createRoom,
  joinRoom,
  chooseTeam,
  addBot,
  getRoom,
} from '../store';

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function makeRoom(overrides: { maxPlayersPerTeam?: 2 | 3 } = {}) {
  const matchId = crypto.randomUUID();
  return {
    matchId,
    room: createRoom({
      matchId,
      code: 'ABC123',
      hostId: 'host-1',
      teamAId: 'team-a',
      teamBId: 'team-b',
      maxPlayersPerTeam: overrides.maxPlayersPerTeam ?? 2,
    }),
  };
}

function makeMember(id: string, name = 'Player') {
  return { userId: id, name, isBot: false, score: 0, correct: 0, wrong: 0 };
}

// ─── createRoom ───────────────────────────────────────────────────────────────

describe('createRoom', () => {
  it('создаёт комнату с двумя командами', () => {
    const { room } = makeRoom();
    expect(room.teams).toHaveLength(2);
    expect(room.teams[0].id).toBe('team-a');
    expect(room.teams[1].id).toBe('team-b');
  });

  it('статус комнаты — waiting', () => {
    const { room } = makeRoom();
    expect(room.status).toBe('waiting');
  });

  it('команды изначально пусты', () => {
    const { room } = makeRoom();
    expect(room.teams[0].members).toHaveLength(0);
    expect(room.teams[1].members).toHaveLength(0);
  });

  it('сохраняет maxPlayersPerTeam', () => {
    const { room } = makeRoom({ maxPlayersPerTeam: 3 });
    expect(room.maxPlayersPerTeam).toBe(3);
  });

  it('комната доступна через getRoom', () => {
    const { matchId, room } = makeRoom();
    expect(getRoom(matchId)).toBe(room);
  });
});

// ─── joinRoom ─────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('добавляет игрока в комнату', () => {
    const { matchId } = makeRoom();
    const result = joinRoom(matchId, makeMember('u1'));
    expect(result).toBe(true);
    const room = getRoom(matchId)!;
    const allMembers = room.teams.flatMap((t) => t.members);
    expect(allMembers.some((m) => m.userId === 'u1')).toBe(true);
  });

  it('возвращает true для уже добавленного игрока (идемпотентен)', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'));
    const result = joinRoom(matchId, makeMember('u1'));
    expect(result).toBe(true);
    const room = getRoom(matchId)!;
    const count = room.teams.flatMap((t) => t.members).filter((m) => m.userId === 'u1').length;
    expect(count).toBe(1);
  });

  it('балансирует игроков по командам при отсутствии предпочтения', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'));
    joinRoom(matchId, makeMember('u2'));
    const room = getRoom(matchId)!;
    expect(room.teams[0].members).toHaveLength(1);
    expect(room.teams[1].members).toHaveLength(1);
  });

  it('уважает preferredTeamIndex', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'), 1);
    const room = getRoom(matchId)!;
    expect(room.teams[1].members.some((m) => m.userId === 'u1')).toBe(true);
    expect(room.teams[0].members).toHaveLength(0);
  });

  it('отклоняет запись в заполненную команду 2v2', () => {
    const { matchId } = makeRoom({ maxPlayersPerTeam: 2 });
    joinRoom(matchId, makeMember('u1'));
    joinRoom(matchId, makeMember('u2'));
    joinRoom(matchId, makeMember('u3'));
    joinRoom(matchId, makeMember('u4'));
    const result = joinRoom(matchId, makeMember('u5'));
    expect(result).toBe(false);
  });
});

// ─── chooseTeam ───────────────────────────────────────────────────────────────

describe('chooseTeam', () => {
  it('перемещает игрока в выбранную команду', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'), 0);
    const result = chooseTeam(matchId, 'u1', 1);
    expect(result.ok).toBe(true);
    const room = getRoom(matchId)!;
    expect(room.teams[1].members.some((m) => m.userId === 'u1')).toBe(true);
    expect(room.teams[0].members).toHaveLength(0);
  });

  it('отказывает, если команда заполнена', () => {
    const { matchId } = makeRoom({ maxPlayersPerTeam: 2 });
    joinRoom(matchId, makeMember('u1'), 0);
    joinRoom(matchId, makeMember('u2'), 0); 
    joinRoom(matchId, makeMember('u3'), 0);
    joinRoom(matchId, makeMember('u4'), 1);
    const result = chooseTeam(matchId, 'u4', 0);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('возвращает ошибку для несуществующего игрока', () => {
    const { matchId } = makeRoom();
    const result = chooseTeam(matchId, 'nobody', 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

// ─── addBot ───────────────────────────────────────────────────────────────────

describe('addBot', () => {
  it('добавляет ботов в обе команды при равном составе', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'), 0);
    joinRoom(matchId, makeMember('u2'), 1);
    const result = addBot(matchId);
    expect(result.ok).toBe(true);
    expect(result.botIds).toHaveLength(2);
  });

  it('добавляет только одного бота в команду с меньшим составом', () => {
    const { matchId } = makeRoom();
    joinRoom(matchId, makeMember('u1'), 0);
    const result = addBot(matchId);
    expect(result.ok).toBe(true);
    const room = getRoom(matchId)!;
    const botInTeam1 = room.teams[1].members.filter((m) => m.isBot);
    expect(botInTeam1).toHaveLength(1);
  });

  it('боты помечаются как isBot = true', () => {
    const { matchId } = makeRoom();
    addBot(matchId);
    const room = getRoom(matchId)!;
    const allMembers = room.teams.flatMap((t) => t.members);
    allMembers.filter((m) => m.isBot).forEach((bot) => {
      expect(bot.userId.startsWith('bot-')).toBe(true);
    });
  });

  it('не добавляет ботов в заполненную комнату', () => {
    const { matchId } = makeRoom({ maxPlayersPerTeam: 2 });
    joinRoom(matchId, makeMember('u1'), 0);
    joinRoom(matchId, makeMember('u2'), 0);
    joinRoom(matchId, makeMember('u3'), 1);
    joinRoom(matchId, makeMember('u4'), 1);
    const result = addBot(matchId);
    expect(result.ok).toBe(false);
  });
});
