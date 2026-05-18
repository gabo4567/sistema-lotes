// src/navigation/AppNavigator.js

import React, { useCallback, useContext, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "./navigationRef";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import LotesScreen from "../screens/LotesScreen";
import TurnosScreen from "../screens/TurnosScreen";
import PerfilScreen from "../screens/PerfilScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import MisUbicacionesScreen from "../screens/MisUbicacionesScreen";
import MisInsumosScreen from "../screens/MisInsumosScreen";
import EditarUbicacionScreen from "../screens/EditarUbicacionScreen";
import ConfiguracionScreen from "../screens/ConfiguracionScreen";
import { AuthContext } from "../context/AuthContext";
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from "react-native";
import OfflineIndicator from "../components/OfflineIndicator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [routeName, setRouteName] = useState(null);
  const gearTop = useMemo(() => Math.max(insets.top, 8), [insets.top]);
  const showGear = Boolean(user) && routeName === "Home";
  // navRef local ya no se usa — se usa navigationRef compartido

  const syncRouteName = useCallback(() => {
    try {
      const current = navigationRef.current?.getCurrentRoute?.()?.name || null;
      setRouteName(current);
    } catch {
      setRouteName(null);
    }
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={syncRouteName}
      onStateChange={syncRouteName}
    >
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={{ marginTop: 12, color: "#1e8449" }}>Cargando…</Text>
        </View>
      ) : (
        user ? (
          <View style={{ flex: 1 }}>
            <OfflineIndicator />
            {showGear ? (
              <TouchableOpacity
                style={[styles.gearBtn, { top: gearTop + 6 }]}
                onPress={() => {
                  try {
                    navigationRef.current?.navigate?.("Configuracion");
                  } catch {}
                }}
              >
                <Ionicons name="settings-outline" size={22} color="#6b7280" />
              </TouchableOpacity>
            ) : null}
            <Stack.Navigator key="auth" screenOptions={{ headerShown: false }} initialRouteName="Home">
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Lotes" component={LotesScreen} />
              <Stack.Screen name="Turnos" component={TurnosScreen} />
              <Stack.Screen name="MisUbicaciones" component={MisUbicacionesScreen} />
              <Stack.Screen name="MisInsumos" component={MisInsumosScreen} />
              <Stack.Screen name="EditarUbicacion" component={EditarUbicacionScreen} />
              <Stack.Screen name="Perfil" component={PerfilScreen} />
              <Stack.Screen name="Configuracion" component={ConfiguracionScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            </Stack.Navigator>
          </View>
        ) : (
          <Stack.Navigator key="guest" screenOptions={{ headerShown: false }} initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </Stack.Navigator>
        )
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  gearBtn: {
    position: "absolute",
    right: 12,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
