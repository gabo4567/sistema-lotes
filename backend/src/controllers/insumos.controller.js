import { db } from "../utils/firebase.js";

const RUBROS_INSUMOS = ["Plastico", "Media sombra", "Complementarios", "Fertilizantes", "Remedios", "Hilos"];
const DEFAULT_RUBRO_INSUMO = "Complementarios";

const normalizeTextKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const slugify = (value) => normalizeTextKey(value).replace(/\s+/g, "-").slice(0, 120) || "insumo";

const normalizeRubro = (value, nombre = "") => {
  const raw = normalizeTextKey(value);
  const byValue = RUBROS_INSUMOS.find((r) => normalizeTextKey(r) === raw);
  if (byValue) return byValue;

  const n = normalizeTextKey(nombre);
  if (n.includes("media sombra")) return "Media sombra";
  if (n.includes("fertiliz") || n.includes("nitrato")) return "Fertilizantes";
  if (n.includes("hilo")) return "Hilos";
  if (n.includes("bifentrin") || n.includes("command") || n.includes("confidor") || n.includes("debrot")) return "Remedios";
  if (n.includes("carpa") || n.includes("plastico")) return "Plastico";
  return DEFAULT_RUBRO_INSUMO;
};

const parseCantidad = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const s = String(value ?? "").trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeProductorInsumoEstado = ({ cantidadAsignada, cantidadEntregada }) => {
  const asig = toNumber(cantidadAsignada, 0);
  const ent = toNumber(cantidadEntregada, 0);
  if (asig > 0 && ent >= asig) return "entregado";
  return "pendiente";
};

const resolveProductor = async (identifier) => {
  const ipt = String(identifier || "").trim();
  if (!ipt) return null;
  const snap = await db.collection("productores").where("ipt", "==", ipt).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ipt, data: doc.data() || {} };
  }
  return null;
};

const resolveProductorStorageId = async (identifier) => {
  return String(identifier || "").trim();
};

const getProductorNombre = async (productorId) => {
  const resolved = await resolveProductor(productorId);
  if (!resolved) return "";
  const productor = resolved.data || {};
  return String(productor.nombreCompleto || productor.nombre || productor.razonSocial || "").trim();
};

const buildNormalizePatchProductorInsumo = (raw) => {
  const patch = {};

  const cantidadAsignada = toNumber(raw?.cantidadAsignada, 0);
  let cantidadEntregada = raw?.cantidadEntregada;
  if (cantidadEntregada === undefined || cantidadEntregada === null) {
    const est = String(raw?.estado || "").toLowerCase().trim();
    if (est === "entregado" && cantidadAsignada > 0) cantidadEntregada = cantidadAsignada;
    else cantidadEntregada = 0;
    patch.cantidadEntregada = cantidadEntregada;
  }

  const ent = toNumber(cantidadEntregada, 0);
  let entFixed = ent;
  if (entFixed < 0) entFixed = 0;
  if (cantidadAsignada >= 0 && entFixed > cantidadAsignada) entFixed = cantidadAsignada;
  if (entFixed !== ent) patch.cantidadEntregada = entFixed;

  const estado = normalizeProductorInsumoEstado({ cantidadAsignada, cantidadEntregada: entFixed });
  if (!["pendiente", "entregado"].includes(String(raw?.estado || "").toLowerCase().trim())) {
    patch.estado = estado;
  } else if (String(raw?.estado || "").toLowerCase().trim() !== estado) {
    patch.estado = estado;
  }

  if (raw?.createdAt === undefined) {
    patch.createdAt = raw?.fechaAsignacion || raw?.creadoEn || new Date();
  }
  if (raw?.updatedAt === undefined) {
    patch.updatedAt = new Date();
  }

  return {
    normalized: {
      ...raw,
      productorId: raw?.productorId !== undefined ? String(raw.productorId) : raw?.productorId,
      cantidadAsignada,
      cantidadEntregada: entFixed,
      estado,
      createdAt: raw?.createdAt ?? patch.createdAt,
      updatedAt: raw?.updatedAt ?? patch.updatedAt,
    },
    patch,
  };
};

export const getDisponibilidadInsumos = async (productorId) => {
  const pid = await resolveProductorStorageId(productorId);
  if (!pid) {
    return { totalAsignado: 0, totalEntregado: 0, totalDisponible: 0, tieneDisponible: false, porCategoria: {} };
  }

  const [snap, insumosSnap] = await Promise.all([
    db.collection("productorInsumos").where("productorId", "==", pid).get(),
    db.collection("insumos").get(),
  ]);
  const insumoMap = {};
  insumosSnap.docs.forEach((d) => { insumoMap[d.id] = d.data()?.nombre || d.id; });

  let totalAsignado = 0;
  let totalEntregado = 0;
  let totalDisponible = 0;
  const porCategoria = {};

  snap.docs.forEach((d) => {
    const raw = d.data() || {};
    if (raw.activo === false) return;
    const { normalized } = buildNormalizePatchProductorInsumo(raw);
    const asig = toNumber(normalized.cantidadAsignada, 0);
    const ent = toNumber(normalized.cantidadEntregada, 0);
    if (asig <= 0) return;
    totalAsignado += asig;
    totalEntregado += ent;
    const disponible = Math.max(0, asig - ent);
    totalDisponible += disponible;

    const categoria = insumoMap[normalized.insumoId] || null;
    if (categoria) {
      if (!porCategoria[categoria]) porCategoria[categoria] = { asignado: 0, entregado: 0, disponible: 0 };
      porCategoria[categoria].asignado += asig;
      porCategoria[categoria].entregado += ent;
      porCategoria[categoria].disponible += disponible;
    }
  });

  return {
    totalAsignado,
    totalEntregado,
    totalDisponible,
    tieneDisponible: totalDisponible > 0,
    porCategoria,
  };
};

const crearInsumoOld = async (req, res) => {
  try {
    const { nombre, cantidadDisponible, unidad, descripcion, estado } = req.body;
    if (!nombre || !NOMBRES_PERMITIDOS.includes(String(nombre))) {
      return res.status(400).json({ error: "Nombre de insumo inválido" });
    }
    // Normalizar nombre: mapear variantes sin acento a la forma canónica
    let nom = String(nombre);
    if (nom === "Almacibo") nom = "Almácigo";

    const cant = Number(cantidadDisponible ?? 0);
    if (!isFinite(cant) || cant < 0) return res.status(400).json({ error: "Cantidad disponible inválida" });
    // Upsert: si existe un insumo con el mismo nombre, sumar stock en el mismo documento
    const existingSnap = await db.collection("insumos").where("nombre", "==", nom).limit(1).get();
    if (!existingSnap.empty) {
      const ref = existingSnap.docs[0].ref;
      const data = existingSnap.docs[0].data();
      const nuevoStock = Number(data.cantidadDisponible || 0) + cant;
      const update = { cantidadDisponible: nuevoStock, updatedAt: new Date() };
      if (unidad) update.unidad = String(unidad);
      if (descripcion) update.descripcion = String(descripcion);
      await ref.update(update);
      const updatedDoc = await ref.get();
      return res.json({ id: ref.id, ...updatedDoc.data() });
    }
    // Si no existe, crear nuevo
    const insumo = {
      nombre: nom,
      cantidadDisponible: cant,
      unidad: unidad ? String(unidad) : "bolsas",
      descripcion: descripcion ? String(descripcion) : "",
      estado: (estado && ["disponible","no_disponible"].includes(String(estado))) ? String(estado) : "disponible",
      activo: true,
      creadoEn: new Date(),
    };
    const docRef = await db.collection("insumos").add(insumo);
    res.json({ id: docRef.id, ...insumo });
  } catch (e) {
    res.status(500).json({ error: "Error al crear insumo" });
  }
};

export const listarInsumos = async (req, res) => {
  try {
    const snap = await db.collection("insumos").get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener insumos" });
  }
};

export const obtenerInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("insumos").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Insumo no encontrado" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener insumo" });
  }
};

export const crearInsumo = async (req, res) => {
  try {
    const { nombre, rubro, unidad, descripcion, activo } = req.body;
    const nom = String(nombre || "").trim();
    if (!nom) return res.status(400).json({ error: "Nombre de insumo obligatorio" });

    const existingSnap = await db.collection("insumos").where("nombre", "==", nom).limit(1).get();
    if (!existingSnap.empty) {
      const ref = existingSnap.docs[0].ref;
      const update = {
        rubro: normalizeRubro(rubro, nom),
        activo: activo !== false,
        estado: activo === false ? "inactivo" : "activo",
        updatedAt: new Date(),
      };
      if (unidad) update.unidad = String(unidad);
      if (descripcion !== undefined) update.descripcion = String(descripcion || "");
      await ref.update(update);
      const updatedDoc = await ref.get();
      return res.json({ id: ref.id, ...updatedDoc.data() });
    }

    const insumo = {
      nombre: nom,
      rubro: normalizeRubro(rubro, nom),
      cantidadDisponible: 0,
      unidad: unidad ? String(unidad) : "bolsas",
      descripcion: descripcion ? String(descripcion) : "",
      estado: activo === false ? "inactivo" : "activo",
      activo: activo !== false,
      creadoEn: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await db.collection("insumos").add(insumo);
    res.json({ id: docRef.id, ...insumo });
  } catch (e) {
    res.status(500).json({ error: "Error al crear insumo" });
  }
};

export const actualizarInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.nombre !== undefined) {
      data.nombre = String(data.nombre || "").trim();
      if (!data.nombre) return res.status(400).json({ error: "Nombre de insumo obligatorio" });
    }
    delete data.cantidadDisponible;
    if (data.rubro !== undefined) data.rubro = normalizeRubro(data.rubro, data.nombre);
    if (data.activo !== undefined) {
      data.activo = data.activo !== false;
      data.estado = data.activo ? "activo" : "inactivo";
    } else if (data.estado !== undefined) {
      const est = String(data.estado).toLowerCase().trim();
      data.activo = est !== "inactivo" && est !== "no_disponible";
      data.estado = data.activo ? "activo" : "inactivo";
    }
    if (data.unidad !== undefined) data.unidad = String(data.unidad);
    data.updatedAt = new Date();
    await db.collection("insumos").doc(id).update(data);
    res.json({ message: "Insumo actualizado" });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar insumo" });
  }
};

const actualizarInsumoOld = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.nombre && !NOMBRES_PERMITIDOS.includes(String(data.nombre))) {
      return res.status(400).json({ error: "Nombre de insumo inválido" });
    }
    if (data.cantidadDisponible !== undefined) {
      const cant = Number(data.cantidadDisponible);
      if (!isFinite(cant) || cant < 0) return res.status(400).json({ error: "Cantidad disponible inválida" });
      data.cantidadDisponible = cant;
    }
    if (data.estado !== undefined) {
      const est = String(data.estado);
      const valid = ["disponible","no_disponible"];
      if (!valid.includes(est)) return res.status(400).json({ error: "Estado inválido" });
      data.estado = est;
    }
    if (data.unidad !== undefined) data.unidad = String(data.unidad);
    data.updatedAt = new Date();
    await db.collection("insumos").doc(id).update(data);
    res.json({ message: "Insumo actualizado" });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar insumo" });
  }
};

export const eliminarInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("insumos").doc(id).delete();
    res.json({ message: "Insumo eliminado" });
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar insumo" });
  }
};

const asignarInsumoAProductorOld = async (req, res) => {
  try {
    const { id } = req.params; // insumoId
    const { productorId, cantidadAsignada } = req.body;
    const pid = await resolveProductorStorageId(productorId);
    if (!pid) return res.status(400).json({ error: "Debe seleccionar al productor para asignarle los insumos" });
    const cant = Number(cantidadAsignada);
    if (!isFinite(cant) || cant <= 0) return res.status(400).json({ error: "cantidadAsignada inválida" });
    const refInsumo = db.collection("insumos").doc(id);
    const [insSnap, productorNombre] = await Promise.all([
      refInsumo.get(),
      getProductorNombre(pid),
    ]);
    if (!insSnap.exists) return res.status(404).json({ error: "Insumo no encontrado" });
    const ins = insSnap.data();
    const disponible = Number(ins.cantidadDisponible || 0);
    // Buscar asignación existente pendiente para este productor y este insumo
    const existingSnap = await db.collection("productorInsumos")
      .where("productorId", "==", pid)
      .where("insumoId", "==", String(id))
      .where("estado", "==", "pendiente")
      .limit(1)
      .get();

    if (existingSnap.empty) {
      if (disponible < cant) return res.status(400).json({ error: "Stock insuficiente" });
      const asignacion = {
        productorId: pid,
        productorNombre,
        insumoId: id,
        cantidadAsignada: cant,
        cantidadEntregada: 0,
        fechaAsignacion: new Date(),
        estado: "pendiente",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const asignRef = await db.collection("productorInsumos").add(asignacion);
      await refInsumo.update({ cantidadDisponible: disponible - cant, updatedAt: new Date() });
      return res.json({ id: asignRef.id, ...asignacion });
    } else {
      // Sumar cantidad en el mismo registro
      const asignDoc = existingSnap.docs[0];
      const data = asignDoc.data();
      const actual = Number(data.cantidadAsignada || 0);
      if (disponible < cant) return res.status(400).json({ error: "Stock insuficiente" });
      const nueva = actual + cant;
      const prevEnt = toNumber(data?.cantidadEntregada, 0);
      if (prevEnt < 0) return res.status(400).json({ error: "cantidadEntregada inválida en la asignación existente" });
      const estado = normalizeProductorInsumoEstado({ cantidadAsignada: nueva, cantidadEntregada: prevEnt });
      await asignDoc.ref.update({
        cantidadAsignada: nueva,
        cantidadEntregada: prevEnt,
        estado,
        updatedAt: new Date(),
        productorNombre: productorNombre || data?.productorNombre || "",
        ...(data?.createdAt === undefined ? { createdAt: data?.fechaAsignacion || new Date() } : {}),
      });
      await refInsumo.update({ cantidadDisponible: disponible - cant, updatedAt: new Date() });
      const updated = await asignDoc.ref.get();
      return res.json({ id: asignDoc.id, ...updated.data() });
    }
  } catch (e) {
    res.status(500).json({ error: "Error al asignar insumo" });
  }
};

export const asignarInsumoAProductor = async (req, res) => {
  try {
    const { id } = req.params;
    const { productorId, cantidadAsignada } = req.body;
    const pid = await resolveProductorStorageId(productorId);
    if (!pid) return res.status(400).json({ error: "Debe seleccionar al productor para asignarle los insumos" });
    const cant = parseCantidad(cantidadAsignada);
    if (!Number.isFinite(cant) || cant <= 0) return res.status(400).json({ error: "cantidadAsignada invalida" });

    const refInsumo = db.collection("insumos").doc(id);
    const [insSnap, productorNombre] = await Promise.all([
      refInsumo.get(),
      getProductorNombre(pid),
    ]);
    if (!insSnap.exists) return res.status(404).json({ error: "Insumo no encontrado" });

    const existingSnap = await db.collection("productorInsumos")
      .where("productorId", "==", pid)
      .where("insumoId", "==", String(id))
      .where("estado", "==", "pendiente")
      .limit(1)
      .get();

    if (existingSnap.empty) {
      const asignacion = {
        productorId: pid,
        productorNombre,
        insumoId: id,
        cantidadAsignada: cant,
        cantidadEntregada: 0,
        fechaAsignacion: new Date(),
        estado: "pendiente",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const asignRef = await db.collection("productorInsumos").add(asignacion);
      await refInsumo.update({ updatedAt: new Date() });
      return res.json({ id: asignRef.id, ...asignacion });
    }

    const asignDoc = existingSnap.docs[0];
    const data = asignDoc.data();
    const actual = Number(data.cantidadAsignada || 0);
    const nueva = actual + cant;
    const prevEnt = toNumber(data?.cantidadEntregada, 0);
    const estado = normalizeProductorInsumoEstado({ cantidadAsignada: nueva, cantidadEntregada: prevEnt });
    await asignDoc.ref.update({
      cantidadAsignada: nueva,
      cantidadEntregada: prevEnt,
      estado,
      updatedAt: new Date(),
      productorNombre: productorNombre || data?.productorNombre || "",
      ...(data?.createdAt === undefined ? { createdAt: data?.fechaAsignacion || new Date() } : {}),
    });
    await refInsumo.update({ updatedAt: new Date() });
    const updated = await asignDoc.ref.get();
    return res.json({ id: asignDoc.id, ...updated.data() });
  } catch (e) {
    res.status(500).json({ error: "Error al asignar insumo" });
  }
};

export const listarAsignacionesPorInsumo = async (req, res) => {
  try {
    const { id } = req.params; // insumoId
    const snap = await db.collection("productorInsumos").where("insumoId", "==", id).get();
    const batch = db.batch();
    let writes = 0;
    const items = snap.docs.map(d => {
      const raw = d.data() || {};
      const { normalized, patch } = buildNormalizePatchProductorInsumo(raw);
      if (Object.keys(patch).length > 0) {
        batch.update(d.ref, patch);
        writes++;
      }
      return { id: d.id, ...normalized };
    });
    if (writes > 0) await batch.commit();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener asignaciones" });
  }
};

export const listarAsignacionesPorProductor = async (req, res) => {
  try {
    const { productorId } = req.params;
    const pid = await resolveProductorStorageId(productorId);
    const snap = await db.collection("productorInsumos").where("productorId", "==", pid).get();
    const batch = db.batch();
    let writes = 0;
    const items = snap.docs.map(d => {
      const raw = d.data() || {};
      const { normalized, patch } = buildNormalizePatchProductorInsumo(raw);
      if (Object.keys(patch).length > 0) {
        batch.update(d.ref, patch);
        writes++;
      }
      return { id: d.id, ...normalized };
    });
    if (writes > 0) await batch.commit();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener asignaciones" });
  }
};

export const listarResumenAsignacionesPorProductor = async (req, res) => {
  try {
    const [asignSnap, prodSnap] = await Promise.all([
      db.collection("productorInsumos").get(),
      db.collection("productores").get(),
    ]);

    const productoresByIpt = new Map();
    prodSnap.docs.forEach((doc) => {
      const p = doc.data() || {};
      const ipt = String(p.ipt || doc.id || "").trim();
      if (!ipt) return;
      productoresByIpt.set(ipt, {
        id: doc.id,
        ipt,
        nombre: p.nombreCompleto || p.nombre || "",
        cuil: p.cuil || "",
        telefono: p.telefono || "",
        paraje: p.paraje || "",
        activo: p.activo !== false,
      });
    });

    const byProductor = new Map();
    asignSnap.docs.forEach((doc) => {
      const raw = doc.data() || {};
      if (raw.activo === false) return;
      const { normalized } = buildNormalizePatchProductorInsumo(raw);
      const productorId = String(normalized.productorId || "").trim();
      if (!productorId) return;
      const asignado = toNumber(normalized.cantidadAsignada, 0);
      const entregado = toNumber(normalized.cantidadEntregada, 0);
      if (asignado <= 0) return;
      const prod = productoresByIpt.get(productorId) || {};
      const current = byProductor.get(productorId) || {
        productorId,
        ipt: productorId,
        productorNombre: prod.nombre || normalized.productorNombre || "",
        cuil: prod.cuil || "",
        telefono: prod.telefono || "",
        paraje: prod.paraje || "",
        activo: prod.activo !== false,
        asignaciones: 0,
        totalAsignado: 0,
        totalEntregado: 0,
        totalDisponible: 0,
        pendientes: 0,
        entregadas: 0,
      };
      current.productorNombre = current.productorNombre || normalized.productorNombre || "";
      current.asignaciones += 1;
      current.totalAsignado += asignado;
      current.totalEntregado += entregado;
      current.totalDisponible += Math.max(0, asignado - entregado);
      if (normalizeProductorInsumoEstado({ cantidadAsignada: asignado, cantidadEntregada: entregado }) === "entregado") {
        current.entregadas += 1;
      } else {
        current.pendientes += 1;
      }
      byProductor.set(productorId, current);
    });

    const productores = Array.from(byProductor.values()).sort((a, b) => {
      const an = String(a.productorNombre || "").localeCompare(String(b.productorNombre || ""), "es");
      return an || String(a.ipt).localeCompare(String(b.ipt), "es", { numeric: true });
    });
    const resumen = productores.reduce((acc, p) => {
      acc.productores += 1;
      acc.asignaciones += Number(p.asignaciones || 0);
      acc.totalAsignado += Number(p.totalAsignado || 0);
      acc.totalEntregado += Number(p.totalEntregado || 0);
      acc.totalDisponible += Number(p.totalDisponible || 0);
      return acc;
    }, { productores: 0, asignaciones: 0, totalAsignado: 0, totalEntregado: 0, totalDisponible: 0 });

    res.json({ resumen, productores });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener resumen de asignaciones" });
  }
};

const actualizarAsignacionOld = async (req, res) => {
  try {
    const { asignacionId } = req.params;
    const { cantidadAsignada, cantidadEntregada, descripcion } = req.body;
    const ref = db.collection("productorInsumos").doc(String(asignacionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Asignación no encontrada" });
    const asign = snap.data();
    const vieja = toNumber(asign?.cantidadAsignada, 0);
    const entVieja = toNumber(
      asign?.cantidadEntregada ?? (String(asign?.estado || "").toLowerCase().trim() === "entregado" ? vieja : 0),
      0
    );
    let delta = 0;
    let nueva = vieja;
    let nuevaEnt = entVieja;
    if (cantidadAsignada !== undefined) {
      nueva = Number(cantidadAsignada);
      if (!isFinite(nueva) || nueva <= 0) return res.status(400).json({ error: "cantidadAsignada inválida" });
      if (entVieja < 0) return res.status(400).json({ error: "cantidadEntregada inválida" });
      if (entVieja > nueva) return res.status(400).json({ error: "cantidadEntregada no puede ser mayor que cantidadAsignada" });
      delta = nueva - vieja;
    }
    if (cantidadEntregada !== undefined) {
      nuevaEnt = Number(cantidadEntregada);
      if (!isFinite(nuevaEnt) || nuevaEnt < 0) return res.status(400).json({ error: "cantidadEntregada inválida" });
      if (nuevaEnt > nueva) return res.status(400).json({ error: "cantidadEntregada no puede ser mayor que cantidadAsignada" });
    }
    if (delta !== 0) {
      const iref = db.collection("insumos").doc(String(asign.insumoId));
      const isnap = await iref.get();
      if (!isnap.exists) return res.status(404).json({ error: "Insumo asociado no encontrado" });
      const ins = isnap.data();
      const stock = Number(ins.cantidadDisponible || 0);
      if (delta > 0) {
        if (stock < delta) return res.status(400).json({ error: "Stock insuficiente" });
        await iref.update({ cantidadDisponible: stock - delta, updatedAt: new Date() });
      } else {
        await iref.update({ cantidadDisponible: stock + Math.abs(delta), updatedAt: new Date() });
      }
    }
    const estado = normalizeProductorInsumoEstado({ cantidadAsignada: nueva, cantidadEntregada: nuevaEnt });
    const updateData = { cantidadAsignada: nueva, cantidadEntregada: nuevaEnt, estado, updatedAt: new Date() };
    if (asign?.createdAt === undefined) updateData.createdAt = asign?.fechaAsignacion || new Date();
    if (descripcion !== undefined) updateData.descripcion = String(descripcion || "");
    await ref.update(updateData);
    res.json({ message: "Asignación actualizada" });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar asignación" });
  }
};

export const actualizarAsignacion = async (req, res) => {
  try {
    const { asignacionId } = req.params;
    const { cantidadAsignada, cantidadEntregada, descripcion } = req.body;
    const ref = db.collection("productorInsumos").doc(String(asignacionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Asignacion no encontrada" });
    const asign = snap.data();
    const vieja = toNumber(asign?.cantidadAsignada, 0);
    const entVieja = toNumber(
      asign?.cantidadEntregada ?? (String(asign?.estado || "").toLowerCase().trim() === "entregado" ? vieja : 0),
      0
    );

    let nueva = vieja;
    let nuevaEnt = entVieja;
    if (cantidadAsignada !== undefined) {
      nueva = parseCantidad(cantidadAsignada);
      if (!Number.isFinite(nueva) || nueva <= 0) return res.status(400).json({ error: "cantidadAsignada invalida" });
    }
    if (cantidadEntregada !== undefined) {
      nuevaEnt = parseCantidad(cantidadEntregada);
      if (!Number.isFinite(nuevaEnt) || nuevaEnt < 0) return res.status(400).json({ error: "cantidadEntregada invalida" });
    }
    if (nuevaEnt > nueva) return res.status(400).json({ error: "cantidadEntregada no puede ser mayor que cantidadAsignada" });

    const estado = normalizeProductorInsumoEstado({ cantidadAsignada: nueva, cantidadEntregada: nuevaEnt });
    const updateData = { cantidadAsignada: nueva, cantidadEntregada: nuevaEnt, estado, updatedAt: new Date() };
    if (asign?.createdAt === undefined) updateData.createdAt = asign?.fechaAsignacion || new Date();
    if (descripcion !== undefined) updateData.descripcion = String(descripcion || "");
    await ref.update(updateData);
    res.json({ message: "Asignacion actualizada" });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar asignacion" });
  }
};
export const obtenerDisponibilidadInsumosProductor = async (req, res) => {
  try {
    const { productorId } = req.params;
    const pid = await resolveProductorStorageId(productorId);

    const [snap, insumosSnap] = await Promise.all([
      db.collection("productorInsumos").where("productorId", "==", pid).get(),
      db.collection("insumos").get(),
    ]);

    const insumoMap = {};
    insumosSnap.docs.forEach(d => { insumoMap[d.id] = d.data()?.nombre || d.id; });

    const batch = db.batch();
    let writes = 0;

    let totalAsignado = 0;
    let totalEntregado = 0;
    let totalDisponible = 0;
    let asignaciones = 0;
    const porCategoria = {};

    snap.docs.forEach((d) => {
      const raw = d.data() || {};
      if (raw.activo === false) return;
      const { normalized, patch } = buildNormalizePatchProductorInsumo(raw);
      if (Object.keys(patch).length > 0) {
        batch.update(d.ref, patch);
        writes++;
      }

      const asig = toNumber(normalized.cantidadAsignada, 0);
      const ent = toNumber(normalized.cantidadEntregada, 0);
      if (asig <= 0) return;
      totalAsignado += asig;
      totalEntregado += ent;
      const disp = Math.max(0, asig - ent);
      totalDisponible += disp;
      if (disp > 0) asignaciones++;

      const categoria = insumoMap[normalized.insumoId] || null;
      if (categoria) {
        if (!porCategoria[categoria]) porCategoria[categoria] = { asignado: 0, entregado: 0, disponible: 0 };
        porCategoria[categoria].asignado += asig;
        porCategoria[categoria].entregado += ent;
        porCategoria[categoria].disponible += disp;
      }
    });

    if (writes > 0) await batch.commit();

    const tieneDisponible = totalDisponible > 0;
    res.json({
      disponible: tieneDisponible,
      asignaciones,
      totalAsignado,
      totalEntregado,
      totalDisponible,
      tieneDisponible,
      porCategoria,
    });
  } catch (e) {
    res.status(500).json({ error: "Error al verificar disponibilidad" });
  }
};

export const marcarAsignacionesEntregadas = async (req, res) => {
  try {
    const { productorId } = req.params;
    const pid = await resolveProductorStorageId(productorId);
    const snap = await db.collection("productorInsumos").where("productorId", "==", pid).where("estado", "==", "pendiente").get();
    const batch = db.batch();
    const now = new Date();
    snap.docs.forEach(doc => {
      const raw = doc.data() || {};
      const asig = toNumber(raw?.cantidadAsignada, 0);
      const entrega = Math.max(0, asig);
      batch.update(doc.ref, {
        cantidadAsignada: asig,
        cantidadEntregada: entrega,
        estado: normalizeProductorInsumoEstado({ cantidadAsignada: asig, cantidadEntregada: entrega }),
        fechaEntrega: now,
        updatedAt: now,
        ...(raw?.createdAt === undefined ? { createdAt: raw?.fechaAsignacion || now } : {}),
      });
    });
    await batch.commit();
    res.json({ message: "Asignaciones marcadas como entregadas", cantidad: snap.docs.length });
  } catch (e) {
    res.status(500).json({ error: "Error al marcar entregas" });
  }
};

const eliminarAsignacionesPorIptOld = async (req, res) => {
  try {
    const { ipt } = req.params;
    const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (psnap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const asnap = await db.collection("productorInsumos").where("productorId", "==", String(ipt)).get();
    if (asnap.empty) return res.json({ eliminadas: 0, stockRestituido: {} });
    const stockRestituido = {};
    const batch = db.batch();
    for (const doc of asnap.docs) {
      const data = doc.data();
      const cant = Number(data.cantidadAsignada || 0);
      const insId = String(data.insumoId);
      if (data.estado !== "entregado" && cant > 0) {
        const iref = db.collection("insumos").doc(insId);
        const isnap = await iref.get();
        if (isnap.exists) {
          const stock = Number(isnap.data().cantidadDisponible || 0);
          const nuevo = stock + cant;
          batch.update(iref, { cantidadDisponible: nuevo, updatedAt: new Date() });
          stockRestituido[insId] = (stockRestituido[insId] || 0) + cant;
        }
      }
      batch.delete(doc.ref);
    }
    await batch.commit();
    res.json({ eliminadas: asnap.docs.length, stockRestituido });
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar asignaciones" });
  }
};

export const eliminarAsignacionesPorIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (psnap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const asnap = await db.collection("productorInsumos").where("productorId", "==", String(ipt)).get();
    if (asnap.empty) return res.json({ eliminadas: 0 });
    for (const group of chunkArray(asnap.docs, 450)) {
      const batch = db.batch();
      group.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    res.json({ eliminadas: asnap.docs.length });
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar asignaciones" });
  }
};

export const importarAsignacionesInsumos = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const campania = String(req.body?.campania || req.body?.campaña || "2025-2026").trim() || "2025-2026";
    const fuente = String(req.body?.fuente || "excel").trim() || "excel";
    if (rows.length === 0) return res.status(400).json({ error: "No se recibieron filas para importar" });

    const productoresSnap = await db.collection("productores").get();
    const productoresByIpt = new Map();
    productoresSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const ipt = String(data.ipt || "").trim();
      if (ipt) productoresByIpt.set(ipt, { id: doc.id, data });
    });

    const insumosSnap = await db.collection("insumos").get();
    const insumosByName = new Map();
    insumosSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const key = normalizeTextKey(data.nombre);
      if (key) insumosByName.set(key, { id: doc.id, ref: doc.ref, data });
    });

    const now = new Date();
    const insumosToWrite = new Map();
    const productoresToWrite = new Map();
    const asignacionesToWrite = new Map();
    const errores = [];
    const productoresNoEncontrados = new Set();
    let filasProcesadas = 0;
    let filasSinInsumos = 0;

    rows.forEach((row, index) => {
      const ipt = String(row?.ipt || row?.fet || "").trim();
      if (!ipt) {
        errores.push({ fila: index + 1, error: "Fila sin IPT/FET" });
        return;
      }
      const productor = productoresByIpt.get(ipt);
      if (!productor) {
        productoresNoEncontrados.add(ipt);
      }

      const insumos = Array.isArray(row?.insumos) ? row.insumos : [];
      const validos = insumos
        .map((item) => ({
          nombre: String(item?.nombre || "").trim(),
          cantidad: parseCantidad(item?.cantidad),
          unidad: String(item?.unidad || "").trim() || "unidades",
          rubro: normalizeRubro(item?.rubro, item?.nombre),
          estado: String(item?.estado || row?.estado || "").toLowerCase().trim(),
        }))
        .filter((item) => item.nombre && item.cantidad > 0);

      if (validos.length === 0) {
        filasSinInsumos += 1;
        return;
      }

      filasProcesadas += 1;
      const productorNombre = String(
        productor?.data?.nombreCompleto || productor?.data?.nombre || row?.productorNombre || row?.nombre || ""
      ).trim();
      if (!productor) {
        const activoRaw = String(row?.activo || "SI").toLowerCase().trim();
        productoresToWrite.set(ipt, {
          ipt,
          nombreCompleto: productorNombre || `Productor IPT ${ipt}`,
          nombre: productorNombre || `Productor IPT ${ipt}`,
          cuil: String(row?.cuil || "").trim(),
          telefono: String(row?.telefono || "").replace(/[^\d+]/g, ""),
          email: String(row?.email || "").trim().toLowerCase(),
          domicilioCasa: String(row?.domicilio || "").trim(),
          paraje: String(row?.paraje || "").trim(),
          estado: String(row?.estadoProductor || "Nuevo").trim() || "Nuevo",
          activo: !["no", "false", "0", "inactivo"].includes(activoRaw),
          requiereCambioContrasena: true,
          historialIngresos: 0,
          fechaRegistro: now,
          creadoDesdeImportacionInsumos: true,
          fuenteImportacion: fuente,
          campaniaImportacion: campania,
          createdAt: now,
          updatedAt: now,
        });
      }

      validos.forEach((item) => {
        const key = normalizeTextKey(item.nombre);
        let insumo = insumosByName.get(key);
        if (!insumo) {
          const id = `insumo-${slugify(item.nombre)}`;
          const ref = db.collection("insumos").doc(id);
          insumo = { id, ref, data: {} };
          insumosByName.set(key, insumo);
        }

        insumosToWrite.set(insumo.id, {
          ref: insumo.ref,
          data: {
            nombre: item.nombre,
            rubro: item.rubro,
            unidad: item.unidad,
            cantidadDisponible: 0,
            activo: true,
            estado: "activo",
            descripcion: insumo.data?.descripcion || "",
            fuenteImportacion: fuente,
            campania,
            updatedAt: now,
            ...(insumo.data?.creadoEn ? {} : { creadoEn: now }),
          },
        });

        const cantidadEntregada = item.estado === "entregado" ? item.cantidad : 0;
        const estado = normalizeProductorInsumoEstado({
          cantidadAsignada: item.cantidad,
          cantidadEntregada,
        });
        const asignacionId = `${slugify(ipt)}_${slugify(insumo.id)}_${slugify(campania)}`;
        asignacionesToWrite.set(asignacionId, {
          productorId: ipt,
          productorNombre,
          insumoId: insumo.id,
          cantidadAsignada: item.cantidad,
          cantidadEntregada,
          estado,
          activo: true,
          campania,
          fuenteImportacion: fuente,
          fechaAsignacion: now,
          updatedAt: now,
          createdAt: now,
        });
      });
    });

    const writes = [];
    productoresToWrite.forEach((data, ipt) => {
      writes.push({ ref: db.collection("productores").doc(String(ipt)), data, merge: true });
    });
    insumosToWrite.forEach(({ ref, data }) => {
      writes.push({ ref, data, merge: true });
    });
    asignacionesToWrite.forEach((data, id) => {
      writes.push({ ref: db.collection("productorInsumos").doc(id), data, merge: true });
    });

    for (const group of chunkArray(writes, 450)) {
      const batch = db.batch();
      group.forEach((w) => batch.set(w.ref, w.data, { merge: w.merge }));
      await batch.commit();
    }

    res.json({
      message: "Importacion de insumos procesada",
      campania,
      filasRecibidas: rows.length,
      filasProcesadas,
      filasSinInsumos,
      productoresCreados: productoresToWrite.size,
      insumosCreadosOActualizados: insumosToWrite.size,
      asignacionesCreadasOActualizadas: asignacionesToWrite.size,
      productoresNoEncontrados: [],
      productoresDetectadosComoNuevos: Array.from(productoresNoEncontrados),
      errores,
    });
  } catch (e) {
    console.error("Error al importar asignaciones de insumos:", e);
    res.status(500).json({ error: "Error al importar asignaciones de insumos" });
  }
};

const actualizarTipoInsumoAsignadoOld = async (req, res) => {
  try {
    const { asignacionId } = req.params;
    const { newInsumoId } = req.body;

    if (!newInsumoId) return res.status(400).json({ error: "Nuevo insumo ID es requerido" });

    const asignacionRef = db.collection("productorInsumos").doc(asignacionId);
    const asignacionSnap = await asignacionRef.get();

    if (!asignacionSnap.exists) return res.status(404).json({ error: "Asignación no encontrada" });

    const asignacionData = asignacionSnap.data();
    const oldInsumoId = asignacionData.insumoId;
    const productorId = asignacionData.productorId;
    const cantidadAsignada = Number(asignacionData.cantidadAsignada || 0);

    if (oldInsumoId === newInsumoId) {
      return res.status(400).json({ error: "El nuevo insumo es el mismo que el actual" });
    }

    const batch = db.batch();

    // 1. Devolver stock al insumo original
    const oldInsumoRef = db.collection("insumos").doc(oldInsumoId);
    const oldInsumoSnap = await oldInsumoRef.get();
    if (oldInsumoSnap.exists) {
      const oldInsumoData = oldInsumoSnap.data();
      const oldStock = Number(oldInsumoData.cantidadDisponible || 0);
      batch.update(oldInsumoRef, { cantidadDisponible: oldStock + cantidadAsignada, updatedAt: new Date() });
    }

    // 2. Restar stock del nuevo insumo (o consolidar si ya existe una asignación)
    const newInsumoRef = db.collection("insumos").doc(newInsumoId);
    const newInsumoSnap = await newInsumoRef.get();
    if (!newInsumoSnap.exists) return res.status(404).json({ error: "Nuevo insumo no encontrado" });
    const newInsumoData = newInsumoSnap.data();
    const newStock = Number(newInsumoData.cantidadDisponible || 0);

    if (newStock < cantidadAsignada) {
      return res.status(400).json({ error: "Stock insuficiente para el nuevo insumo" });
    }

    // Buscar si ya existe una asignación para el productor y el nuevo insumo
    const existingNewAsignacionSnap = await db.collection("productorInsumos")
      .where("productorId", "==", productorId)
      .where("insumoId", "==", newInsumoId)
      .where("estado", "==", "pendiente")
      .limit(1)
      .get();

    if (!existingNewAsignacionSnap.empty) {
      // Consolidar en la asignación existente
      const existingAsignacionDoc = existingNewAsignacionSnap.docs[0];
      const existingAsignacionData = existingAsignacionDoc.data();
      const nuevaCantidad = Number(existingAsignacionData.cantidadAsignada || 0) + cantidadAsignada;
      batch.update(existingAsignacionDoc.ref, { cantidadAsignada: nuevaCantidad, updatedAt: new Date() });
      batch.delete(asignacionRef); // Eliminar la asignación original
    } else {
      // Actualizar la asignación original con el nuevo insumoId
      batch.update(asignacionRef, { insumoId: newInsumoId, updatedAt: new Date() });
    }
    
    batch.update(newInsumoRef, { cantidadDisponible: newStock - cantidadAsignada, updatedAt: new Date() });

    await batch.commit();
    res.json({ message: "Tipo de insumo asignado actualizado exitosamente" });

  } catch (e) {
    console.error("Error al actualizar tipo de insumo asignado:", e);
    res.status(500).json({ error: e.message || "Error al actualizar tipo de insumo asignado" });
  }
};

export const actualizarTipoInsumoAsignado = async (req, res) => {
  try {
    const { asignacionId } = req.params;
    const { newInsumoId } = req.body;

    if (!newInsumoId) return res.status(400).json({ error: "Nuevo insumo ID es requerido" });

    const asignacionRef = db.collection("productorInsumos").doc(asignacionId);
    const asignacionSnap = await asignacionRef.get();
    if (!asignacionSnap.exists) return res.status(404).json({ error: "Asignacion no encontrada" });

    const asignacionData = asignacionSnap.data();
    const oldInsumoId = asignacionData.insumoId;
    const productorId = asignacionData.productorId;
    const cantidadAsignada = Number(asignacionData.cantidadAsignada || 0);
    const cantidadEntregada = Number(asignacionData.cantidadEntregada || 0);

    if (oldInsumoId === newInsumoId) {
      return res.status(400).json({ error: "El nuevo insumo es el mismo que el actual" });
    }

    const newInsumoSnap = await db.collection("insumos").doc(newInsumoId).get();
    if (!newInsumoSnap.exists) return res.status(404).json({ error: "Nuevo insumo no encontrado" });

    const existingNewAsignacionSnap = await db.collection("productorInsumos")
      .where("productorId", "==", productorId)
      .where("insumoId", "==", newInsumoId)
      .where("estado", "==", "pendiente")
      .limit(1)
      .get();

    const batch = db.batch();
    if (!existingNewAsignacionSnap.empty) {
      const existingDoc = existingNewAsignacionSnap.docs[0];
      const existing = existingDoc.data() || {};
      const nuevaCantidad = Number(existing.cantidadAsignada || 0) + cantidadAsignada;
      const nuevaEntregada = Number(existing.cantidadEntregada || 0) + cantidadEntregada;
      batch.update(existingDoc.ref, {
        cantidadAsignada: nuevaCantidad,
        cantidadEntregada: nuevaEntregada,
        estado: normalizeProductorInsumoEstado({ cantidadAsignada: nuevaCantidad, cantidadEntregada: nuevaEntregada }),
        updatedAt: new Date(),
      });
      batch.delete(asignacionRef);
    } else {
      batch.update(asignacionRef, { insumoId: newInsumoId, updatedAt: new Date() });
    }

    await batch.commit();
    res.json({ message: "Tipo de insumo asignado actualizado exitosamente" });
  } catch (e) {
    console.error("Error al actualizar tipo de insumo asignado:", e);
    res.status(500).json({ error: e.message || "Error al actualizar tipo de insumo asignado" });
  }
};
