import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import api, { setAuthFailureHandler } from "../api/axios";
import { getFirebaseApp } from "../utils/firebaseClient";
import { tokenStore } from "../utils/tokenStore";

import { AuthContext } from "./AuthContextBase.js";

const normalizeRole = (r) => {
  return String(r || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const decodeToken = (token) => {
  try {
    const base64Url = token.split(".")[1];

    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      "="
    );

    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decodificando token:", error);
    return null;
  }
};

const isExpiredToken = (tokenPayload) => {
  if (!tokenPayload?.exp) return false;
  return Date.now() > Number(tokenPayload.exp);
};

const DEFAULT_ADMIN_PERMISOS = {
  turnos: true,
  productores: true,
  insumos: true,
  lotes: true,
  users: true,
  informes: true,
};

const DEFAULT_LIMITED_ADMIN_PERMISOS = {
  turnos: false,
  productores: false,
  insumos: false,
  lotes: false,
  users: false,
  informes: false,
};

const hasPermisos = (permisos) => {
  return Boolean(
    permisos &&
    typeof permisos === "object" &&
    Object.keys(permisos).length > 0
  );
};

const resolvePermisos = ({ role, permisos }) => {
  if (hasPermisos(permisos)) return permisos;
  return normalizeRole(role).includes("limitado")
    ? DEFAULT_LIMITED_ADMIN_PERMISOS
    : DEFAULT_ADMIN_PERMISOS;
};

export const AuthProvider = ({ children }) => {
  const auth = getAuth(getFirebaseApp());
  const [user, setUser] = useState(() => {
    const t = tokenStore.get();
    if (t) {
      const p = decodeToken(t);
      if (isExpiredToken(p)) {
        tokenStore.clear();
        return null;
      }
      const role = normalizeRole(p?.role);
      return p
        ? {
            token: t,
            ...p,
            role,
            permisos: resolvePermisos({ role, permisos: p?.permisos }),
          }
        : { token: t };
    }
    return null;
  });

  const [authReady, setAuthReady] = useState(false);

  const applySession = useCallback((token, extraData = {}) => {
    tokenStore.set(token);

    const p = decodeToken(token);

    const role = normalizeRole(
      extraData?.role || p?.role
    );

    const permisos = resolvePermisos({
      role,
      permisos: hasPermisos(extraData?.permisos)
        ? extraData.permisos
        : p?.permisos,
    });

    setUser(
      p
        ? {
            token,
            ...p,
            ...extraData,
            role,
            permisos,
          }
        : {
            token,
            ...extraData,
            permisos,
          }
    );
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const login = useCallback((token, extraData = {}) => {
    applySession(token, extraData);
  }, [applySession]);

  const logout = useCallback(async ({ redirect = false } = {}) => {
    clearSession();

    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      null;
    }

    if (redirect) {
      window.location.assign("/login");
    }
  }, [auth, clearSession]);

  const revalidateWithBackend = useCallback(async (firebaseUser, forceRefresh = false) => {
    const idToken = await firebaseUser.getIdToken(forceRefresh);
    const response = await api.post(
      "/auth/login",
      { idToken },
      { _skipAuthFailureHandler: true }
    );
    return response?.data?.token;
  }, []);

  useEffect(() => {
    let isMounted = true;

    setAuthFailureHandler(() => {
      logout({ redirect: true });
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (!firebaseUser) {
        const token = tokenStore.get();
        if (!token) {
          clearSession();
        }
        setAuthReady(true);
        return;
      }

      try {
        let backendToken;
        try {
          backendToken = await revalidateWithBackend(firebaseUser, false);
        } catch {
          backendToken = await revalidateWithBackend(firebaseUser, true);
        }

        if (!backendToken) {
          throw new Error("No se obtuvo token del backend");
        }

        applySession(backendToken);
      } catch {
        await logout({ redirect: false });
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    });

    return () => {
      isMounted = false;
      setAuthFailureHandler(null);
      unsubscribe();
    };
  }, [auth, applySession, clearSession, logout, revalidateWithBackend]);

  const value = useMemo(() => ({ user, authReady, login, logout }), [user, authReady, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
  
