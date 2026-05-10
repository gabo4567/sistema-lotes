import Constants from "expo-constants";
import { Platform } from "react-native";

export const getIngresoMetadata = () => ({
  plataforma: Platform.OS || "desconocida",
  appVersion:
    Constants?.expoConfig?.version ||
    Constants?.manifest?.version ||
    "desconocida",
  evento: "login",
});
