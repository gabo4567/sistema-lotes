// src/navigation/AppNavigator.js

import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import LotesScreen from "../screens/LotesScreen";
import TurnosScreen from "../screens/TurnosScreen";
import PerfilScreen from "../screens/PerfilScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import MisUbicacionesScreen from "../screens/MisUbicacionesScreen";
import EditarUbicacionScreen from "../screens/EditarUbicacionScreen";
import { AuthContext } from "../context/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";
import OfflineIndicator from "../components/OfflineIndicator";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  return (
    <NavigationContainer>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={{ marginTop: 12, color: "#1e8449" }}>Cargando…</Text>
        </View>
      ) : (
        user ? (
          <View style={{ flex: 1 }}>
            <OfflineIndicator />
            <Stack.Navigator key="auth" screenOptions={{ headerShown: false }} initialRouteName="Home">
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Lotes" component={LotesScreen} />
              <Stack.Screen name="Turnos" component={TurnosScreen} />
              <Stack.Screen name="MisUbicaciones" component={MisUbicacionesScreen} />
              <Stack.Screen name="EditarUbicacion" component={EditarUbicacionScreen} />
              <Stack.Screen name="Perfil" component={PerfilScreen} />
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
