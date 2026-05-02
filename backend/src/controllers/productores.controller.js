// src/controllers/productores.controller.js
import { db, admin } from "../utils/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

// Crear productor
export const createProductor = async (req, res) => {
  try {
    const {
      ipt,
      nombreCompleto,
      cuil,
      email,
      telefono,
      domicilioCasa,
      domicilioIngresoCoord,
      estado,
      plantasPorHa,
    } = req.body;
    if (!ipt || !nombreCompleto || !cuil) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
    }

    // Validación de formato de teléfono
    const telRegex = /^\d{10,13}$/;
    if (telefono && !telRegex.test(telefono)) {
      return res.status(400).json({ error: "El número debe contener solo dígitos (10 a 13 números)." });
    }

    // Validar unicidad de IPT
    const existingIpt = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (!existingIpt.empty) {
      return res.status(400).json({ error: "El número de IPT ya se encuentra registrado." });
    }

    // Validar unicidad de CUIL
    const existingCuil = await db.collection("productores").where("cuil", "==", String(cuil)).limit(1).get();
    if (!existingCuil.empty) {
      return res.status(400).json({ error: "El CUIL ya se encuentra registrado." });
    }

    // Validar unicidad de Email
    if (email) {
      const existingEmail = await db.collection("productores").where("email", "==", String(email).toLowerCase()).limit(1).get();
      if (!existingEmail.empty) {
        return res.status(400).json({ error: "El correo electrónico ya se encuentra registrado." });
      }
    }

    const newProductor = {
      ipt: String(ipt),
      nombreCompleto,
      cuil: String(cuil),
      email: email || "",
      telefono: telefono || "",
      domicilioCasa: domicilioCasa || "",
      domicilioIngresoCoord: domicilioIngresoCoord || null,
      plantasPorHa: plantasPorHa ? Number(plantasPorHa) : null,
      requiereCambioContrasena: true,
      historialIngresos: 0,
      fechaRegistro: new Date(),
      activo: true,
    };

    const docRef = await db.collection("productores").add(newProductor);

    const authUid = `prod_${String(ipt)}`;

    // Asegurar que exista un usuario en Firebase Auth con ese UID
    try {
      await admin.auth().getUser(authUid);
    } catch (e) {
      if (e && e.code === "auth/user-not-found") {
        const authData = {
          uid: authUid,
          displayName: nombreCompleto,
        };
        // Si hay email, intentar asignarlo (puede fallar si ya existe)
        if (email) {
          try {
            await admin.auth().getUserByEmail(email);
            // Si no lanza error, el email ya está en uso. No lo asignamos a este Auth Record.
          } catch (err) {
            if (err.code === 'auth/user-not-found') {
              authData.email = email;
            }
          }
        }
        await admin.auth().createUser(authData);
      } else {
        throw e;
      }
    }

    // Sincronizar con la colección de usuarios
    await db.collection("users").doc(authUid).set({
      email: email || "",
      nombre: nombreCompleto,
      role: "Productor",
      ipt: String(ipt),
      activo: true,
      ultimoAcceso: null,
      updatedAt: new Date(),
    }, { merge: true });

    res.json({ id: docRef.id, ...newProductor });
  } catch (error) {
    console.error("Error al crear productor:", error);
    res.status(500).json({ error: "Error al crear productor" });
  }
};

// Obtener todos los productores activos
export const getAllProductores = async (req, res) => {
  try {
    const snapshot = await db.collection("productores").where("activo", "==", true).get();
    const productores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(productores);
  } catch (error) {
    console.error("Error al obtener productores:", error);
    res.status(500).json({ error: "Error al obtener productores" });
  }
};

// Obtener todos los productores inactivos
export const getInactiveProductores = async (req, res) => {
  try {
    const snapshot = await db.collection("productores").where("activo", "==", false).get();
    const productores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(productores);
  } catch (error) {
    console.error("Error al obtener productores inactivos:", error);
    res.status(500).json({ error: "Error al obtener productores inactivos" });
  }
};

// Obtener productor por ID
export const getProductorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("productores").doc(id).get();
    if (!doc.exists || doc.data().activo === false) 
      return res.status(404).json({ error: "Productor no encontrado" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error al obtener productor:", error);
    res.status(500).json({ error: "Error al obtener productor" });
  }
};

export const getProductorByIpt = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    const data = doc.data();
    if (data.activo === false) return res.status(404).json({ error: "Productor no activo" });
    res.json({ id: doc.id, ...data });
  } catch (error) {
    console.error("Error al obtener productor por IPT:", error);
    res.status(500).json({ error: "Error al obtener productor por IPT" });
  }
};

// Actualizar productor
export const updateProductor = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Validación de formato de email si se intenta actualizar
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return res.status(400).json({ error: "Ingrese un correo electrónico válido." });
      }
    }

    // Validación de formato de teléfono si se intenta actualizar
    if (data.telefono) {
      const telRegex = /^\d{10,13}$/;
      if (!telRegex.test(data.telefono)) {
        return res.status(400).json({ error: "El número debe contener solo dígitos (10 a 13 números)." });
      }
    }

    // Validar unicidad de IPT si se está cambiando
    if (data.ipt) {
      const existingIpt = await db.collection("productores").where("ipt", "==", String(data.ipt)).limit(1).get();
      if (!existingIpt.empty && existingIpt.docs[0].id !== id) {
        return res.status(400).json({ error: "El número de IPT ya se encuentra registrado." });
      }
    }

    // Validar unicidad de CUIL si se está cambiando
    if (data.cuil) {
      const existingCuil = await db.collection("productores").where("cuil", "==", String(data.cuil)).limit(1).get();
      if (!existingCuil.empty && existingCuil.docs[0].id !== id) {
        return res.status(400).json({ error: "El CUIL ya se encuentra registrado." });
      }
    }

    // Validar unicidad de Email si se está cambiando
    if (data.email) {
      const existingEmail = await db.collection("productores").where("email", "==", String(data.email).toLowerCase()).limit(1).get();
      if (!existingEmail.empty && existingEmail.docs[0].id !== id) {
        return res.status(400).json({ error: "El correo electrónico ya se encuentra registrado." });
      }
    }

    const ref = db.collection("productores").doc(id);
    await ref.update(data);
    const snap = await ref.get();
    const d = snap.data();
    const ipt = String(d.ipt || "");
    const uid = `prod_${ipt}`;
    const nombre = d.nombreCompleto || d.nombre || "";
    const email = d.email ? String(d.email).toLowerCase() : "";
    const activo = d.activo !== false;
    await db.collection("users").doc(uid).set({
      nombre,
      email,
      role: "Productor",
      ipt,
      activo,
      updatedAt: new Date(),
    }, { merge: true });

    try {
      const byIpt = await db.collection("users").where("ipt", "==", ipt).get();
      for (const udoc of byIpt.docs) {
        await udoc.ref.set({ nombre, email, role: "Productor", ipt, activo, updatedAt: new Date() }, { merge: true });
      }
    } catch (e) {
      console.error("Sync users por ipt falló", ipt, e);
    }

    try {
      if (email) {
        const byEmail = await db.collection("users").where("email", "==", email).get();
        for (const udoc of byEmail.docs) {
          await udoc.ref.set({ nombre, role: "Productor", ipt, activo, updatedAt: new Date() }, { merge: true });
        }
      }
    } catch (e) {
      console.error("Sync users por email falló", email, e);
    }
    res.json({ message: "✅ Productor actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar productor:", error);
    res.status(500).json({ error: "Error al actualizar productor" });
  }
};

// Soft delete de productor
export const deleteProductor = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("productores").doc(id).update({ activo: false });
    res.json({ message: "✅ Productor desactivado correctamente" });
  } catch (error) {
    console.error("Error al desactivar productor:", error);
    res.status(500).json({ error: "Error al desactivar productor" });
  }
};

export const resetPasswordProductor = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    await doc.ref.update({ requiereCambioContrasena: true, passwordHash: admin.firestore.FieldValue.delete() });
    res.json({ message: "Contraseña reseteada a CUIL en próximo ingreso" });
  } catch (error) {
    console.error("Error al resetear contraseña:", error);
    res.status(500).json({ error: "Error al resetear contraseña" });
  }
};

export const marcarReempadronado = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    await doc.ref.update({ estado: "Re-empadronado" });
    res.json({ message: "Productor marcado como re-empadronado" });
  } catch (error) {
    console.error("Error al marcar re-empadronado:", error);
    res.status(500).json({ error: "Error al marcar re-empadronado" });
  }
};

export const historialIngresos = async (req, res) => {
  try {
    const { ipt } = req.params;
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    const data = doc.data();
    res.json({ historialIngresos: data.historialIngresos || 0 });
  } catch (error) {
    console.error("Error al obtener historial de ingresos:", error);
    res.status(500).json({ error: "Error al obtener historial de ingresos" });
  }
};

export const setPushToken = async (req, res) => {
  try {
    const { ipt } = req.params;
    const { token, type } = req.body;
    if (!token) return res.status(400).json({ error: "Token requerido" });
    const snap = await db.collection("productores").where("ipt", "==", String(ipt)).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Productor no encontrado" });
    const doc = snap.docs[0];
    const rawType = String(type || "").toLowerCase().trim();
    const isExpo = rawType === "expo" || String(token).startsWith("ExponentPushToken");
    const isFcm = rawType === "fcm";
    const payload = isFcm
      ? { fcmTokens: FieldValue.arrayUnion(token) }
      : isExpo
        ? { expoPushTokens: FieldValue.arrayUnion(token) }
        : { pushTokens: FieldValue.arrayUnion(token) };
    await doc.ref.set(payload, { merge: true });
    res.json({ message: "Push token registrado", type: isFcm ? "fcm" : (isExpo ? "expo" : "generic") });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar push token" });
  }
};
