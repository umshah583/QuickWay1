"use client";

import { useEffect, useState } from "react";
import PushNotificationPrompt from "../components/PushNotificationPrompt";

export default function PushNotificationsSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <PushNotificationPrompt />;
}
