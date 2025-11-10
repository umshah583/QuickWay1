"use client";

import { useEffect, useState } from "react";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

async function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeUser(): Promise<boolean> {
  if (!PUBLIC_VAPID_KEY) {
    console.warn("VAPID key missing - push notifications disabled");
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    return true;
  }

  const convertedKey = await urlBase64ToUint8Array(PUBLIC_VAPID_KEY);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    console.error("Failed to register push subscription");
    try {
      await subscription.unsubscribe();
    } catch (error) {
      console.warn("Failed to clean up subscription", error);
    }
    return false;
  }

  return true;
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSupport = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(hasSupport);

    if (!hasSupport) {
      return;
    }

    // register service worker if not already
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("Service worker registration failed", error));

    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((status) => {
        setPermission(status.state as NotificationPermission);
        status.onchange = () => {
          setPermission(status.state as NotificationPermission);
        };
      })
      .catch(() => undefined);

    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager
        .getSubscription()
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => undefined);
    });
  }, []);

  const requestPermission = async () => {
    if (!supported) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      return false;
    }

    const success = await subscribeUser();
    setSubscribed(success);
    return success;
  };

  return {
    supported,
    subscribed,
    permission,
    requestPermission,
  };
}
