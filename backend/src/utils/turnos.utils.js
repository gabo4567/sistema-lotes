export const isTurnosHabilitados = (config) => {
  return config?.estadoActual === true;
};

const AR_FIXED_HOLIDAYS_MMDD = {
  "01-01": "Año Nuevo",
  "03-24": "Día Nacional de la Memoria por la Verdad y la Justicia",
  "04-02": "Día del Veterano y de los Caídos en la Guerra de Malvinas",
  "05-01": "Día del Trabajador",
  "05-25": "Día de la Revolución de Mayo",
  "06-20": "Paso a la Inmortalidad del Gral. Manuel Belgrano",
  "07-09": "Día de la Independencia",
  "12-08": "Inmaculada Concepción de María",
  "12-25": "Navidad",
};

const AR_HOLIDAYS_BY_YEAR = {
  2025: {
    "2025-03-03": "Carnaval",
    "2025-03-04": "Carnaval",
    "2025-04-18": "Viernes Santo",
    "2025-06-16": "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes",
    "2025-08-17": "Paso a la Inmortalidad del Gral. José de San Martín",
    "2025-10-10": "Día del Respeto a la Diversidad Cultural",
    "2025-11-24": "Día de la Soberanía Nacional",
  },
  2026: {
    "2026-02-16": "Carnaval",
    "2026-02-17": "Carnaval",
    "2026-04-03": "Viernes Santo",
    "2026-06-15": "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes",
    "2026-08-17": "Paso a la Inmortalidad del Gral. José de San Martín",
    "2026-10-12": "Día del Respeto a la Diversidad Cultural",
    "2026-11-23": "Día de la Soberanía Nacional",
  },
  2027: {
    "2027-02-15": "Carnaval",
    "2027-02-16": "Carnaval",
    "2027-03-26": "Viernes Santo",
    "2027-06-21": "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes",
    "2027-08-16": "Paso a la Inmortalidad del Gral. José de San Martín",
    "2027-10-11": "Día del Respeto a la Diversidad Cultural",
    "2027-11-22": "Día de la Soberanía Nacional",
  },
};

export const getArgentinaHolidayLabel = (ymd) => {
  const s = String(ymd || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mmdd = `${m[2]}-${m[3]}`;
  if (AR_FIXED_HOLIDAYS_MMDD[mmdd]) return AR_FIXED_HOLIDAYS_MMDD[mmdd];
  const byYear = AR_HOLIDAYS_BY_YEAR[Number(m[1])];
  return byYear?.[s] ?? null;
};
