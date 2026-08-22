"use client";

import { useEffect } from "react";
import Script from "next/script";

import { initOneSignal, ONESIGNAL_APP_ID } from "@/lib/onesignal";

/** Loads the OneSignal SDK and queues init - safe to include unconditionally: init() itself
 * no-ops when NEXT_PUBLIC_ONESIGNAL_APP_ID isn't set (no sandbox account configured yet). */
export default function OneSignalInit() {
  useEffect(() => {
    initOneSignal();
  }, []);

  if (!ONESIGNAL_APP_ID) return null;

  return (
    <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
  );
}
