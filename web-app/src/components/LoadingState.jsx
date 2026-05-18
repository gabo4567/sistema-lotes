import React from "react";

const LoadingState = ({
  title = "Cargando...",
  message = "Espera unos segundos.",
  compact = false,
  className = "",
}) => (
  <div
    className={`loading-state ${compact ? "loading-state--compact" : ""} ${className}`.trim()}
    role="status"
    aria-live="polite"
  >
    <div className="loading-state__content">
      <div className="loading-state__spinner" aria-hidden="true" />
      <div className="loading-state__title">{title}</div>
      {message ? <div className="loading-state__message">{message}</div> : null}
    </div>
  </div>
);

export default LoadingState;
