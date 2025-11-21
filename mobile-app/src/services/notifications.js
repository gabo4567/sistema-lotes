import Constants from "expo-constants";
import { auth } from "./firebase";
import { API_URL } from "../utils/constants";

let NotificationsMod = null;
const loadNotifications = async () => {
  if (NotificationsMod) return NotificationsMod;
  const mod = await import("expo-notifications");
  NotificationsMod = mod;
  return mod;
};

export async function setupNotifications() {
  if (Constants?.appOwnership === "expo") return;
  const Notifications = await loadNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function registerPushToken() {
  try {
    if (Constants?.appOwnership === "expo") return null;
    const Notifications = await loadNotifications();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const tokenResult = await auth.currentUser?.getIdTokenResult();
    const ipt = tokenResult?.claims?.ipt;
    if (!ipt || !token) return token;
    await fetch(`${API_URL}/productores/ipt/${ipt}/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return token;
  } catch (e) {
    if (__DEV__) console.log("registerPushToken error:", e?.message);
    return null;
  }
}