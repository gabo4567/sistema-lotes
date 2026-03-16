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

    extra: {
      eas: {
        projectId: "423de856-e848-434a-b490-07db8aa0f86a"
      }
    },

    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "La app necesita acceder a tu ubicación para mostrar tus lotes en el mapa."
        }
      ]
    ],

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Necesitamos tu ubicación para mostrar tus lotes en el mapa."
      }
    },

    android: {
      package: "com.jgpared.sistemalotes",
      // Temporal: comentar Google Maps si no hay API Key en EAS
      config: {
        // googleMaps: {
        //   apiKey: process.env.GOOGLE_MAPS_API_KEY
        // }
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