import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { appRouter } from '@/server/trpc/router';
import { createTRPCContext } from '@/server/trpc/init';

export const serverTrpc = cache(async () => {
  const h = await headers();
  const ctx = await createTRPCContext({ headers: h });
  return appRouter.createCaller(ctx);
});
