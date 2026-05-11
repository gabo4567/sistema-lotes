const NO_LABELS_STYLE = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export const attachGoogleMapVisualControls = (map, mapsApi) => {
  if (!map || !mapsApi) return () => {};

  const state = {
    base: "map",
    labels: true,
  };

  const control = document.createElement("div");
  Object.assign(control.style, {
    margin: "10px 0 0 10px",
    background: "#ffffff",
    borderRadius: "3px",
    boxShadow: "0 1px 4px rgba(60, 64, 67, 0.3)",
    overflow: "hidden",
    fontFamily: "Roboto, Arial, sans-serif",
  });

  const tabs = document.createElement("div");
  Object.assign(tabs.style, { display: "flex" });

  const makeTab = (label, base) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
      minWidth: "92px",
      border: "0",
      borderRight: base === "map" ? "1px solid #e5e7eb" : "0",
      background: "#ffffff",
      color: "#5f6368",
      cursor: "pointer",
      fontSize: "18px",
      fontWeight: "500",
      padding: "14px 18px",
    });
    button.addEventListener("click", () => {
      state.base = base;
      apply();
    });
    tabs.appendChild(button);
    return button;
  };

  const mapButton = makeTab("Mapa", "map");
  const satelliteButton = makeTab("Satélite", "satellite");

  const checks = document.createElement("div");
  Object.assign(checks.style, {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderTop: "1px solid #e5e7eb",
  });

  const makeCheck = (label, key) => {
    const wrapper = document.createElement("label");
    Object.assign(wrapper.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      color: "#111827",
      cursor: "pointer",
      fontSize: "16px",
      whiteSpace: "nowrap",
      width: "100%",
    });
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state[key];
    Object.assign(input.style, {
      width: "16px",
      height: "16px",
      cursor: "pointer",
    });
    input.addEventListener("change", () => {
      state[key] = input.checked;
      apply();
    });
    const text = document.createElement("span");
    text.textContent = label;
    wrapper.append(input, text);
    checks.appendChild(wrapper);
    return input;
  };

  const labelsInput = makeCheck("Etiquetas", "labels");

  control.append(tabs, checks);

  const apply = () => {
    labelsInput.checked = state.labels;

    const activeTab = {
      background: "#ffffff",
      color: "#111827",
      fontWeight: "700",
    };
    const inactiveTab = {
      background: "#ffffff",
      color: "#5f6368",
      fontWeight: "500",
    };
    Object.assign(mapButton.style, state.base === "map" ? activeTab : inactiveTab);
    Object.assign(satelliteButton.style, state.base === "satellite" ? activeTab : inactiveTab);

    if (state.base === "satellite") {
      map.setOptions({ styles: null });
      map.setMapTypeId(state.labels ? "hybrid" : "satellite");
      return;
    }

    map.setMapTypeId("roadmap");
    map.setOptions({ styles: state.labels ? null : NO_LABELS_STYLE });
  };

  map.controls[mapsApi.ControlPosition.TOP_LEFT].push(control);
  apply();

  return () => {
    control.remove();
  };
};
