declare global {
  var handleSubscriptionEvent: ((eventType: string, data: any) => void) | undefined;
  var broadcastToUser: ((userId: string, event: any) => void) | undefined;
  var broadcastToAll: ((event: any) => void) | undefined;
}

export {};
