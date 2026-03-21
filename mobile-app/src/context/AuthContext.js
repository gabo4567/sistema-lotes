// src/context/AuthContext.js

import React, { createContext, useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase failed to initialize, bail out immediately
    if (!auth) {
      setLoading(false);
      return;
    }

    const watchdog = setTimeout(() => {
      setLoading(false);
    }, 8000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        try {
          if (!currentUser) { setUser(null); setLoading(false); return; }
          const idTokenResult = await currentUser.getIdTokenResult();
          const claims = idTokenResult?.claims || {};
          const nombre = currentUser.displayName || claims.nombreCompleto || claims.nombre || null;
          setUser({ ...currentUser, claims, displayName: nombre || currentUser.email });
        } catch {
          setUser(currentUser);
        } finally {
          setLoading(false);
          clearTimeout(watchdog);
        }
      });
    } catch {
      setUser(null);
      setLoading(false);
      clearTimeout(watchdog);
    }

    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, []);

  const logout = async () => await signOut(auth);

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
