import 'server-only';
import PusherServer from 'pusher';

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const gameChannel = (roomId: string) => `game-${roomId}`;

export const PusherEvent = {
  ROUND_START: 'round:start',
  ROUND_END: 'round:end',
  SCORE_UPDATE: 'score:update',
  GAME_END: 'game:end',
  PLAYER_JOINED: 'player:joined',
  GAME_STARTING: 'game:starting',
} as const;
