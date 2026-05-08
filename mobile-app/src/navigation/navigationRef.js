import { createRef } from "react";

export const navigationRef = createRef();

export const navigateTo = (name, params) => {
  try {
    if (navigationRef.current?.isReady?.()) {
      navigationRef.current.navigate(name, params);
    }
  } catch {}
};
