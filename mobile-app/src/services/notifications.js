import Constants from "expo-constants";
import { API_URL } from "../utils/constants";
import { authFetch, getCurrentAuthContext } from "../api/api";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let NotificationsMod = null;
const loadNotifications = async () => {
  if (NotificationsMod) return NotificationsMod;
  const mod = await import("expo-notifications");
  NotificationsMod = mod;
  return mod;
};

let didInitListeners = false;
let lastForegroundKey = null;

export async function getNotificationPermissionStatus() {
  try {
    if (Constants?.appOwnership === "expo") return "unsupported_expo_go";
    const Notifications = await loadNotifications();
    const { status } = await Notifications.getPermissionsAsync();
    return status || null;
  } catch {
    return null;
  }
}

export async function getNotificationPermissionInfo() {
  try {
    if (Constants?.appOwnership === "expo") {
      return { status: "unsupported_expo_go", granted: false, canAskAgain: false };
    }
    const Notifications = await loadNotifications();
    const perm = await Notifications.getPermissionsAsync();
    const status = perm?.status || null;
    const granted = typeof perm?.granted === "boolean" ? perm.granted : status === "granted";
    const canAskAgain = typeof perm?.canAskAgain === "boolean" ? perm.canAskAgain : null;
    return { status, granted, canAskAgain };
  } catch {
    return { status: null, granted: false, canAskAgain: null };
  }
}

export async function setupNotifications() {
  try {
    if (Constants?.appOwnership === "expo") return;
    const Notifications = await loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Notificaciones",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      } catch {}
    }

    if (!didInitListeners) {
      didInitListeners = true;
      Notifications.addNotificationReceivedListener((notification) => {
        try {
          const title = notification?.request?.content?.title || "Notificación";
          const body = notification?.request?.content?.body || "";
          const key = `${String(title)}|${String(body)}|${String(notification?.date || "")}`;
          if (lastForegroundKey === key) return;
          lastForegroundKey = key;
          Alert.alert(String(title), String(body));
        } catch {}
      });
    }
  } catch (e) {
    if (__DEV__) console.log("setupNotifications error:", e?.message);
  }
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

    let token = null;
    let type = null;
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken?.data ? String(deviceToken.data) : null;
      type = deviceToken?.type ? String(deviceToken.type) : null;
    } catch {}

    if (!token) {
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
        type = "expo";
      } catch {}
    }

    const { ipt } = await getCurrentAuthContext();
    if (!ipt || !token) return token;
    await authFetch(`${API_URL}/productores/ipt/${ipt}/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type }),
    });

    try {
      await AsyncStorage.setItem("notif_push_token_registered_v1", "1");
    } catch {}
    return token;
  } catch (e) {
    if (__DEV__) console.log("registerPushToken error:", e?.message);
    return null;
  }
}
