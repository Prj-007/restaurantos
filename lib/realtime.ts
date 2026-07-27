import Pusher from "pusher";

// Real-time order updates via Pusher Channels (a hosted WebSocket service).
// Vercel's serverless functions can't hold a raw WebSocket connection open,
// so the client subscribes directly to Pusher over a real WebSocket, and API
// routes just publish events to it. Wiring is a no-op (not an error) when
// Pusher env vars aren't configured, so the app still runs without them.
const pusher =
  process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

export const ORDERS_CHANNEL = "orders";
export const ORDER_UPDATED_EVENT = "order-updated";

export async function publishOrderUpdate(order: unknown) {
  if (!pusher) return;
  try {
    await pusher.trigger(ORDERS_CHANNEL, ORDER_UPDATED_EVENT, order);
  } catch (err) {
    console.error("Failed to publish order update", err);
  }
}

export const isRealtimeConfigured = Boolean(pusher);
