import Swal from "sweetalert2";

const getSwalDarkClass = () => {
  if (typeof document === 'undefined') return undefined;
  return document.body.classList.contains('dark-mode') ? 'swal2-dark' : undefined;
};

export async function confirmDialog({ title = '¿Estás seguro?', text = '', icon = 'warning', confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar' } = {}) {
  const res = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#2E7D32',
    cancelButtonColor: '#c0392b',
    focusCancel: true,
    customClass: { popup: getSwalDarkClass() },
  });
  return res.isConfirmed === true;
}

export async function promptDialog({ title = 'Ingresar dato', text = '', inputLabel = '', inputValue = '', confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar', inputPlaceholder = '' } = {}) {
  const res = await Swal.fire({
    title,
    text,
    input: 'text',
    inputLabel,
    inputValue,
    inputPlaceholder,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#2E7D32',
    cancelButtonColor: '#c0392b',
    customClass: { popup: getSwalDarkClass() },
    inputValidator: (value) => {
      if (!value || String(value).trim() === '') return 'Este campo es obligatorio';
      return undefined;
    },
  });
  if (res.isConfirmed) return res.value;
  return null;
}

export async function notify({ title = '', text = '', icon = 'info', confirmButtonText = 'Cerrar' } = {}) {
  await Swal.fire({
    title,
    text,
    icon,
    confirmButtonText,
    confirmButtonColor: '#2E7D32',
    customClass: { popup: getSwalDarkClass() },
  });
}

// Helper genérico: recibe tipo, mensaje y función a ejecutar si confirma
export async function confirmAndRun({ action = 'Acción', message = '', icon = 'warning', onConfirm }) {
  const ok = await confirmDialog({ title: '¿Estás seguro?', text: message || `Vas a realizar: ${action}`, icon });
  if (ok && typeof onConfirm === 'function') return onConfirm();
  return null;
}

