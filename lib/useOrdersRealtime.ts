"use client";

import { useEffect } from "react";
import Pusher from "pusher-js";

// Subscribes to live order updates (new orders, status changes) so the
// Orders/kitchen board reflects changes from other users without a refresh.
// No-ops silently if NEXT_PUBLIC_PUSHER_KEY isn't configured.
export function useOrdersRealtime(onUpdate: (order: unknown) => void) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe("orders");
    channel.bind("order-updated", onUpdate);

    return () => {
      channel.unbind("order-updated", onUpdate);
      pusher.unsubscribe("orders");
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
