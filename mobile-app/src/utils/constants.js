export const COLORS = {
  primary: "#228B22",
  secondary: "#F4A300",
};
import { NativeModules } from "react-native";

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const scriptURL = NativeModules.SourceCode?.scriptURL || "";
const m = scriptURL.match(/^[a-z]+:\/\/([^:/]+)(?::\d+)?/);
const host = m ? m[1] : "localhost";
let base = ENV_URL || `http://${host}:3000`;

// https://x547v1rs-3000.brs.devtunnels.ms/${host}

base = String(base).replace(/\/+$/, "");
export const API_URL = base.endsWith("/api") ? base : `${base}/api`;

// http://${host}:3000

// http://localhost:5173

