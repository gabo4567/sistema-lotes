// mobile-app/app.config.js

import 'dotenv/config';

export default {
  expo: {
    name: "Sistema de Lotes - Mobile",
    slug: "sistema-lotes-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",

    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    assetBundlePatterns: ["**/*"],

    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "La app necesita acceder a tu ubicación para mostrar tus lotes en el mapa."
        }
      ]
      // ❌ Se eliminó "react-native-maps" porque NO posee config plugin
    ],

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Necesitamos tu ubicación para mostrar tus lotes en el mapa."
      }
    },

    android: {
      config: {
        googleMaps: {
          // ✔️ Ahora usa la variable del .env
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    },

    web: {
      favicon: "./assets/favicon.png"
    }
  }
};
