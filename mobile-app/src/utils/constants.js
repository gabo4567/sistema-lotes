export const COLORS = {
  primary: "#228B22",
  secondary: "#F4A300",
};
import { NativeModules } from "react-native";

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const scriptURL = NativeModules.SourceCode?.scriptURL || "";
const m = scriptURL.match(/^[a-z]+:\/\/([^:/]+)(?::\d+)?/);
const host = m ? m[1] : "localhost";
export const API_URL = `${ENV_URL || `http://${host}:3000/api`}`;
