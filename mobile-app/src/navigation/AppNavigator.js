// src/navigation/AppNavigator.js

import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import LotesScreen from "../screens/LotesScreen";
import TurnosScreen from "../screens/TurnosScreen";
import PerfilScreen from "../screens/PerfilScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import MedicionesScreen from "../screens/MedicionesScreen";
import { AuthContext } from "../context/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";

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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Lotes" component={LotesScreen} />
            <Stack.Screen name="Turnos" component={TurnosScreen} />
            <Stack.Screen name="Mediciones" component={MedicionesScreen} />
            <Stack.Screen name="Perfil" component={PerfilScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </>
        )}
      </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
