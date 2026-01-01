declare global {
  var handleSubscriptionEvent: ((eventType: string, data: unknown) => void) | undefined;
  var broadcastToUser: ((userId: string, event: unknown) => void) | undefined;
  var broadcastToAll: ((event: unknown) => void) | undefined;
}

export {};
