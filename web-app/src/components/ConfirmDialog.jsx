import React, { useEffect, useRef } from "react";
import "./ConfirmDialog.css";

/**
 * ConfirmDialog - Modal de confirmación reutilizable
 * 
 * Props:
 * - isOpen: boolean - Si el diálogo está abierto
 * - title: string - Título del diálogo
 * - message: string - Mensaje principal
 * - confirmText: string (default: "Confirmar") - Texto del botón de confirmación
 * - cancelText: string (default: "Cancelar") - Texto del botón de cancelación
 * - onConfirm: function - Callback cuando se confirma
 * - onCancel: function - Callback cuando se cancela
 * - isDangerous: boolean (default: false) - Si es una acción peligrosa (cambia color a rojo)
 * - requiresInput: boolean (default: false) - Si requiere que el usuario ingrese un texto de confirmación
 * - requiredInputValue: string (default: "Confirmar") - Texto que debe ingresar si requiresInput es true
 * - isLoading: boolean (default: false) - Si está en proceso
 * - children: ReactNode - Contenido adicional dentro del diálogo
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  isDangerous = false,
  requiresInput = false,
  requiredInputValue = "Confirmar",
  isLoading = false,
  children,
}) => {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && requiresInput && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, requiresInput]);

  const isConfirmDisabled = requiresInput && inputValue !== requiredInputValue;

  const handleConfirm = () => {
    if (isConfirmDisabled || isLoading) return;
    setInputValue("");
    onConfirm?.();
  };

  const handleCancel = () => {
    setInputValue("");
    onCancel?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isConfirmDisabled && !isLoading) {
      handleConfirm();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={handleCancel}>
      <div className="confirm-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h3 className="confirm-dialog-title">{title}</h3>
          <button
            type="button"
            className="confirm-dialog-close"
            onClick={handleCancel}
            disabled={isLoading}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="confirm-dialog-body">
          {message && <p className="confirm-dialog-message">{message}</p>}
          {children}
          {requiresInput && (
            <div className="confirm-dialog-input-group">
              <label htmlFor="confirm-input" className="confirm-dialog-input-label">
                Escribe <strong>"{requiredInputValue}"</strong> para confirmar:
              </label>
              <input
                ref={inputRef}
                id="confirm-input"
                type="text"
                className="confirm-dialog-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={requiredInputValue}
                disabled={isLoading}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            className="confirm-dialog-btn cancel"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn confirm ${isDangerous ? "dangerous" : ""}`}
            onClick={handleConfirm}
            disabled={isConfirmDisabled || isLoading}
          >
            {isLoading ? "Procesando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
