const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  const seconds = value?._seconds ?? value?.seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

export const isCarnetVencido = (productor = {}) => {
  if (normalizeText(productor.estadoCarnet).includes("vencido")) return true;

  const vencimiento = toDate(productor.fechaVencimientoCarnet);
  if (!vencimiento) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  vencimiento.setHours(0, 0, 0, 0);
  return vencimiento < hoy;
};

export const getProductorBloqueo = (productor = {}) => {
  if (productor.activo === false) {
    return {
      code: "PRODUCTOR_INACTIVO",
      message: "El productor no esta activo.",
    };
  }

  if (normalizeText(productor.estado).includes("vencido")) {
    return {
      code: "PRODUCTOR_ESTADO_VENCIDO",
      message: "El estado del productor no permite operar.",
    };
  }

  if (isCarnetVencido(productor)) {
    return {
      code: "CARNET_VENCIDO",
      message: "El carnet del productor esta vencido.",
    };
  }

  return null;
};
