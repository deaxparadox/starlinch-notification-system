// OneSignal Web SDK v16. Queue calls via OneSignalDeferred until the SDK script (loaded via
// <Script> in app/layout.tsx) has finished loading - see
// https://documentation.onesignal.com/docs/en/web-sdk-reference (verified current as of this
// build, not assumed from memory).

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalWebSdk) => Promise<void> | void>;
  }
}

interface OneSignalWebSdk {
  init: (options: { appId: string }) => Promise<void>;
  Notifications: { requestPermission: () => Promise<void> };
  User: { PushSubscription: { id: string | null | undefined } };
}

export const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

export function initOneSignal() {
  if (!ONESIGNAL_APP_ID) return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({ appId: ONESIGNAL_APP_ID! });
  });
}

/** Prompts for notification permission and resolves with the subscription id, or null if
 * OneSignal isn't configured, permission was denied, or anything else goes wrong. Never
 * throws - a failed push subscription must never block the login flow that calls this. */
export function subscribeToWebPush(): Promise<string | null> {
  if (!ONESIGNAL_APP_ID) {
    console.warn("NEXT_PUBLIC_ONESIGNAL_APP_ID not set - skipping Web Push subscribe");
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        resolve(OneSignal.User.PushSubscription.id ?? null);
      } catch (err) {
        console.warn("OneSignal subscribe failed:", err);
        resolve(null);
      }
    });
  });
}
