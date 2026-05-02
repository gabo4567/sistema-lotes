import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const usePermissionPrompt = () => {
  const resolverRef = useRef(null);
  const [state, setState] = useState({
    visible: false,
    title: "",
    body: "",
    acceptText: "Continuar",
    cancelText: "Ahora no",
  });

  const ask = useCallback(({ title, body, acceptText, cancelText } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        visible: true,
        title: String(title || "Permiso requerido"),
        body: String(body || ""),
        acceptText: String(acceptText || "Continuar"),
        cancelText: String(cancelText || "Ahora no"),
      });
    });
  }, []);

  const close = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState((prev) => ({ ...prev, visible: false }));
    if (typeof resolve === "function") resolve(Boolean(result));
  }, []);

  const Prompt = useMemo(() => {
    return function PermissionPromptModal() {
      if (!state.visible) return null;
      return (
        <Modal
          transparent
          animationType="fade"
          visible={state.visible}
          onRequestClose={() => close(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Text style={styles.title}>{state.title}</Text>
              <Text style={styles.body}>{state.body}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => close(false)}>
                  <Text style={styles.btnSecondaryText}>{state.cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => close(true)}>
                  <Text style={styles.btnPrimaryText}>{state.acceptText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      );
    };
  }, [close, state.body, state.cancelText, state.title, state.acceptText, state.visible]);

  return { ask, Prompt };
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginTop: 14,
  },
  btn: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#16a34a" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnSecondary: { backgroundColor: "#e5e7eb" },
  btnSecondaryText: { color: "#111827", fontWeight: "800" },
});
