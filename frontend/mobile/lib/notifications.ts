import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { API_URL } from "./api";
import { getToken } from "./auth";

// Casos de uso (spec §10): assinatura renovada, curso novo, "continue de onde parou".
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function registerPushNotifications(): Promise<void> {
  if (!Device.isDevice) return; // push real só em device físico
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
  const token = await getToken();
  if (!token) return;
  await fetch(`${API_URL}/api/users/me/push-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
  }).catch(() => {});
}
