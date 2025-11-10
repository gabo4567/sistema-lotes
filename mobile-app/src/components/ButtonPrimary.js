import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function ButtonPrimary({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#228B22",
    padding: 12,
    borderRadius: 10,
    marginVertical: 5,
  },
  text: { color: "#fff", textAlign: "center", fontWeight: "bold" },
});
