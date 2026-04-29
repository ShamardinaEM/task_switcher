import { router } from './init';
import { roomsRouter } from './routers/rooms';
import { matchesRouter } from './routers/matches';
import { leaderboardRouter } from './routers/leaderboard';

export const appRouter = router({
  rooms: roomsRouter,
  matches: matchesRouter,
  leaderboard: leaderboardRouter,
});

export type AppRouter = typeof appRouter;
