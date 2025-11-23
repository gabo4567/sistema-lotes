// Utilidades de alertas institucionales usando SweetAlert2 (CDN)
// Carga perezosa del script y CSS, y expone helpers: confirmDialog, promptDialog, notify

const SWEETALERT_JS = "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
const SWEETALERT_CSS = "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css";

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src='${src}']`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar SweetAlert2'));
    document.head.appendChild(s);
  });
}

function loadCssOnce(href) {
  if (document.querySelector(`link[href='${href}']`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

async function ensureSwal() {
  if (window.Swal) return window.Swal;
  loadCssOnce(SWEETALERT_CSS);
  await loadScriptOnce(SWEETALERT_JS);
  return window.Swal;
}

export async function confirmDialog({ title = '¿Estás seguro?', text = '', icon = 'warning', confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar' } = {}) {
  const Swal = await ensureSwal();
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
  });
  return res.isConfirmed === true;
}

export async function promptDialog({ title = 'Ingresar dato', text = '', inputLabel = '', inputValue = '', confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar', inputPlaceholder = '' } = {}) {
  const Swal = await ensureSwal();
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
    inputValidator: (value) => {
      if (!value || String(value).trim() === '') return 'Este campo es obligatorio';
      return undefined;
    },
  });
  if (res.isConfirmed) return res.value;
  return null;
}

export async function notify({ title = '', text = '', icon = 'info', confirmButtonText = 'Cerrar' } = {}) {
  const Swal = await ensureSwal();
  await Swal.fire({ title, text, icon, confirmButtonText, confirmButtonColor: '#2E7D32' });
}

// Helper genérico: recibe tipo, mensaje y función a ejecutar si confirma
export async function confirmAndRun({ action = 'Acción', message = '', icon = 'warning', onConfirm }) {
  const ok = await confirmDialog({ title: '¿Estás seguro?', text: message || `Vas a realizar: ${action}`, icon });
  if (ok && typeof onConfirm === 'function') return onConfirm();
  return null;
}

