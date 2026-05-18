import React, { useEffect, useState } from "react";

const DismissibleAlert = ({ children, className = "", style, closeLabel = "Cerrar aviso" }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [children, className]);

  if (!visible) return null;

  return (
    <div className={`dismissible-alert ${className}`.trim()} style={style}>
      <div className="dismissible-alert__content">{children}</div>
      <button
        type="button"
        className="dismissible-alert__close"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={() => setVisible(false)}
      >
        x
      </button>
    </div>
  );
};

export default DismissibleAlert;
