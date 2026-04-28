import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import api, { setAuthFailureHandler } from "../api/axios";
import { getFirebaseApp } from "../utils/firebaseClient";
import { tokenStore } from "../utils/tokenStore";

import { AuthContext } from "./AuthContextBase.js";

const normalizeRole = (r) => {
  const v = String(r || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (v === "productor") return "Productor";
  return "Administrador";
};

const decodeToken = (t) => {
  try {
    const parts = String(t).split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));
    return json;
  } catch {
    return null;
  }
};

const isExpiredToken = (tokenPayload) => {
  if (!tokenPayload?.exp) return false;
  return Date.now() > Number(tokenPayload.exp);
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
      return p ? { token: t, ...p, role } : { token: t };
    }
    return null;
  });

  const [authReady, setAuthReady] = useState(false);

  const applySession = useCallback((token) => {
    tokenStore.set(token);
    const p = decodeToken(token);
    const role = normalizeRole(p?.role);
    setUser(p ? { token, ...p, role } : { token });
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const login = useCallback((token) => {
    applySession(token);
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
  
