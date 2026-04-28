import { db } from "../utils/firebase.js";

const NOMBRES_PERMITIDOS = ["Arada", "Almácigo", "Transplante", "Cosecha", "Almácigo"];

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
  const pid = String(productorId || "").trim();
  if (!pid) {
    return { totalAsignado: 0, totalEntregado: 0, totalDisponible: 0, tieneDisponible: false };
  }

  const snap = await db.collection("productorInsumos").where("productorId", "==", pid).get();
  let totalAsignado = 0;
  let totalEntregado = 0;
  let totalDisponible = 0;

  snap.docs.forEach((d) => {
    const raw = d.data() || {};
    if (raw.activo === false) return;
    const { normalized } = buildNormalizePatchProductorInsumo(raw);
    const asig = toNumber(normalized.cantidadAsignada, 0);
    const ent = toNumber(normalized.cantidadEntregada, 0);
    if (asig <= 0) return;
    totalAsignado += asig;
    totalEntregado += ent;
    totalDisponible += Math.max(0, asig - ent);
  });

  return {
    totalAsignado,
    totalEntregado,
    totalDisponible,
    tieneDisponible: totalDisponible > 0,
  };
};

export const crearInsumo = async (req, res) => {
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
      const update = { cantidadDisponible: nuevoStock, unidad: "bolsas", updatedAt: new Date() };
      if (descripcion) update.descripcion = String(descripcion);
      await ref.update(update);
      const updatedDoc = await ref.get();
      return res.json({ id: ref.id, ...updatedDoc.data() });
    }
    // Si no existe, crear nuevo
    const insumo = {
      nombre: nom,
      cantidadDisponible: cant,
      unidad: "bolsas",
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

export const actualizarInsumo = async (req, res) => {
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
    data.unidad = "bolsas";
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

export const asignarInsumoAProductor = async (req, res) => {
  try {
    const { id } = req.params; // insumoId
    const { productorId, cantidadAsignada } = req.body;
    if (!productorId) return res.status(400).json({ error: "Debe seleccionar al productor para asignarle los insumos" });
    const cant = Number(cantidadAsignada);
    if (!isFinite(cant) || cant <= 0) return res.status(400).json({ error: "cantidadAsignada inválida" });
    const refInsumo = db.collection("insumos").doc(id);
    const insSnap = await refInsumo.get();
    if (!insSnap.exists) return res.status(404).json({ error: "Insumo no encontrado" });
    const ins = insSnap.data();
    const disponible = Number(ins.cantidadDisponible || 0);
    // Buscar asignación existente pendiente para este productor y este insumo
    const existingSnap = await db.collection("productorInsumos")
      .where("productorId", "==", String(productorId))
      .where("insumoId", "==", String(id))
      .where("estado", "==", "pendiente")
      .limit(1)
      .get();

    if (existingSnap.empty) {
      if (disponible < cant) return res.status(400).json({ error: "Stock insuficiente" });
      const asignacion = {
        productorId: String(productorId),
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
    const snap = await db.collection("productorInsumos").where("productorId", "==", String(productorId)).get();
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

export const actualizarAsignacion = async (req, res) => {
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
export const obtenerDisponibilidadInsumosProductor = async (req, res) => {
  try {
    const { productorId } = req.params;
    const pid = String(productorId || "").trim();
    const snap = await db.collection("productorInsumos").where("productorId", "==", pid).get();
    const batch = db.batch();
    let writes = 0;

    let totalAsignado = 0;
    let totalEntregado = 0;
    let totalDisponible = 0;
    let asignaciones = 0;

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
    });
  } catch (e) {
    res.status(500).json({ error: "Error al verificar disponibilidad" });
  }
};

export const marcarAsignacionesEntregadas = async (req, res) => {
  try {
    const { productorId } = req.params;
    const snap = await db.collection("productorInsumos").where("productorId", "==", String(productorId)).where("estado", "==", "pendiente").get();
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

export const eliminarAsignacionesPorIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const psnap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (psnap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const productorId = psnap.docs[0].id;
    const asnap = await db.collection("productorInsumos").where("productorId", "==", String(productorId)).get();
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

export const actualizarTipoInsumoAsignado = async (req, res) => {
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
