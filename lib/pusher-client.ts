'use client';
import PusherClient from 'pusher-js';

let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClient) {
    pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusherClient;
}

export function subscribeToGame(
  roomId: string,
  handlers: Record<string, (data: unknown) => void>,
) {
  const client = getPusherClient();
  const channel = client.subscribe(`game-${roomId}`);
  for (const [event, handler] of Object.entries(handlers)) {
    channel.bind(event, handler);
  }
  return () => client.unsubscribe(`game-${roomId}`);
}
