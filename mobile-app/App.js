import React from "react";

// IMPORTÁ firebase ANTES de TODO
import "./src/services/firebase";

import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { useEffect } from "react";
import { registerPushToken } from "./src/services/notifications";

export default function App() {
  useEffect(() => {
    registerPushToken();
  }, []);
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
