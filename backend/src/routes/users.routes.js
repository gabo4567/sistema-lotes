// src/routes/users.routes.js
import express from "express";
import { db, admin } from "../utils/firebase.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => EMAIL_REGEX.test(value);

const normalizeRoleValue = (role) => {
  const v = String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (v === "productor") return "productor";
  if (v.includes("limitado")) return "administrador limitado";
  if (v === "administrador") return "administrador";
  return "";
};

const PERMISSION_KEYS = ["turnos", "productores", "insumos", "lotes", "users", "informes"];
const OFFICIAL_ROLES = ["administrador", "administrador limitado"];

const DEFAULT_ADMIN_PERMISOS = {
  turnos: true,
  productores: true,
  insumos: true,
  lotes: true,
  users: true,
  informes: true,
};

const DEFAULT_LIMITED_ADMIN_PERMISOS = {
  turnos: false,
  productores: false,
  insumos: false,
  lotes: false,
  users: false,
  informes: false,
};

const hasPermisos = (permisos) => {
  return Boolean(
    permisos &&
    typeof permisos === "object" &&
    Object.keys(permisos).length > 0
  );
};

const normalizePermisos = (permisos = {}) => {
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(permisos?.[key]);
    return acc;
  }, {});
};

const resolvePermisosForRole = (role, permisos) => {
  const normalizedRole = normalizeRoleValue(role);
  if (normalizedRole === "administrador") return { ...DEFAULT_ADMIN_PERMISOS };
  if (hasPermisos(permisos)) return normalizePermisos(permisos);
  return { ...DEFAULT_LIMITED_ADMIN_PERMISOS };
};

const resolveRole = (data) => {
  const normalized = normalizeRoleValue(data?.role);
  if (normalized) return normalized;
  const looksLikeProductor = Boolean(data?.ipt);
  return looksLikeProductor ? "productor" : "administrador";
};

const isPanelAdminRole = (role) => {
  const normalized = normalizeRoleValue(role);
  return normalized === "administrador" || normalized === "administrador limitado";
};

const canManageUsers = (data) => {
  const role = resolveRole(data);
  const permisos = resolvePermisosForRole(role, data?.permisos);
  return role === "administrador" && permisos.users === true;
};

const requireFullAdminUsersAccess = async (req, res, next) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) return res.status(401).json({ error: "No autenticado" });

    const requesterDoc = await db.collection("users").doc(uid).get();
    if (!requesterDoc.exists || !canManageUsers(requesterDoc.data() || {})) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    next();
  } catch (error) {
    console.error("Error validando permisos de usuarios:", error);
    res.status(500).json({ error: "Error validando permisos" });
  }
};

router.use(requireFullAdminUsersAccess);

const assertAdminUserDoc = async (uid) => {
  const targetDoc = await db.collection("users").doc(uid).get();
  if (!targetDoc.exists) return { error: { status: 404, message: "Usuario no encontrado" } };
  const targetData = targetDoc.data() || {};
  const targetRole = resolveRole(targetData);
  if (!isPanelAdminRole(targetRole)) {
    return { error: { status: 400, message: "Solo se pueden administrar usuarios Administradores desde esta seccion" } };
  }
  return { targetDoc, targetData, targetRole };
};

const hasOtherFullAdmin = async (uidToExclude) => {
  const snapshot = await db.collection("users").get();
  return snapshot.docs.some((doc) => {
    if (doc.id === uidToExclude) return false;
    const data = doc.data() || {};
    return data.activo !== false && canManageUsers(data);
  });
};

const assertCanChangeAccess = async ({ req, uid, nextRole, nextPermisos }) => {
  if (req.user?.uid === uid) {
    return { error: { status: 400, message: "No puede editar sus propios permisos o rol" } };
  }

  const { targetData, targetRole, error } = await assertAdminUserDoc(uid);
  if (error) return { error };

  const currentCanManage = targetData.activo !== false && canManageUsers(targetData);
  const futureRole = nextRole || targetRole;
  const futurePermisos = nextPermisos || resolvePermisosForRole(futureRole, targetData.permisos);
  const futureCanManage =
    targetData.activo !== false &&
    normalizeRoleValue(futureRole) === "administrador" &&
    futurePermisos.users === true;

  if (currentCanManage && !futureCanManage && !(await hasOtherFullAdmin(uid))) {
    return {
      error: {
        status: 400,
        message: "No se puede quitar el ultimo administrador con permiso de usuarios",
      },
    };
  }

  return { targetData, targetRole };
};

router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let hasWrites = false;

    const uidsWithoutNombre = snapshot.docs
      .filter((doc) => !doc.data()?.nombre)
      .map((doc) => doc.id);

    const authDisplayNames = {};
    if (uidsWithoutNombre.length > 0) {
      try {
        const authUsers = await admin.auth().getUsers(uidsWithoutNombre.map((uid) => ({ uid })));
        authUsers.users.forEach((u) => {
          if (u.displayName) authDisplayNames[u.uid] = u.displayName;
        });
      } catch {}
    }

    const all = snapshot.docs.map((doc) => {
      const data = doc.data();
      const roleResolved = resolveRole(data);
      const permisos = resolvePermisosForRole(roleResolved, data?.permisos);
      const updates = {};

      if (data?.role !== roleResolved) updates.role = roleResolved;
      if (isPanelAdminRole(roleResolved) && JSON.stringify(normalizePermisos(data?.permisos)) !== JSON.stringify(permisos)) {
        updates.permisos = permisos;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, { ...updates, updatedAt: new Date() });
        hasWrites = true;
      }

      const nombre = data?.nombre || authDisplayNames[doc.id] || null;
      return { id: doc.id, ...data, nombre, role: roleResolved, permisos };
    });
    if (hasWrites) await batch.commit();

    const admins = all.filter((u) => isPanelAdminRole(u?.role));
    const seen = new Map();
    for (const u of admins) {
      const key = normalizeEmail(u?.email);
      if (!key) {
        seen.set(`${u.id}_${Math.random()}`, u);
        continue;
      }
      const cur = seen.get(key);
      if (!cur || (u?.activo === true && cur?.activo !== true)) {
        seen.set(key, u);
      }
    }
    res.json(Array.from(seen.values()));
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const activo = req.body?.activo !== false;

    if (!nombre) return res.status(400).json({ error: "Ingrese el nombre del administrador" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Ingrese un correo electronico valido" });
    if (password.length < 6) return res.status(400).json({ error: "La contrasena debe tener al menos 6 caracteres" });

    const existingUsers = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!existingUsers.empty) return res.status(409).json({ error: "Ya existe un administrador con ese correo" });

    try {
      await admin.auth().getUserByEmail(email);
      return res.status(409).json({ error: "Ya existe un usuario de autenticacion con ese correo" });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
      disabled: !activo,
    });

    const doc = {
      email,
      nombre,
      role: "administrador",
      permisos: { ...DEFAULT_ADMIN_PERMISOS },
      activo,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("users").doc(userRecord.uid).set(doc);
    res.status(201).json({ id: userRecord.uid, ...doc });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.put("/:uid/permisos", async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user?.uid === uid) {
      return res.status(400).json({ error: "No puede editar sus propios permisos" });
    }

    const { targetData, targetRole, error: targetError } = await assertAdminUserDoc(uid);
    if (targetError) return res.status(targetError.status).json({ error: targetError.message });

    if (targetRole === "administrador") {
      const permisos = { ...DEFAULT_ADMIN_PERMISOS };
      await db.collection("users").doc(uid).update({
        permisos,
        updatedAt: new Date(),
      });
      return res.json({ message: "Permisos actualizados", permisos });
    }

    const permisos = normalizePermisos(req.body?.permisos || req.body || {});
    const { error } = await assertCanChangeAccess({
      req,
      uid,
      nextPermisos: permisos,
    });
    if (error) return res.status(error.status).json({ error: error.message });

    await db.collection("users").doc(uid).update({
      permisos,
      updatedAt: new Date(),
    });

    return res.json({
      message: "Permisos actualizados",
      permisos,
      role: targetRole,
      id: uid,
      email: targetData.email || "",
    });
  } catch (error) {
    console.error("Error al actualizar permisos:", error);
    res.status(500).json({ error: "Error al actualizar permisos" });
  }
});

router.put("/:uid/role", async (req, res) => {
  try {
    const { uid } = req.params;
    const role = normalizeRoleValue(req.body?.role);

    if (!OFFICIAL_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rol invalido" });
    }

    const permisos = resolvePermisosForRole(role, req.body?.permisos);
    const { error } = await assertCanChangeAccess({
      req,
      uid,
      nextRole: role,
      nextPermisos: permisos,
    });
    if (error) return res.status(error.status).json({ error: error.message });

    await db.collection("users").doc(uid).update({
      role,
      permisos,
      updatedAt: new Date(),
    });

    return res.json({ message: "Rol actualizado", role, permisos });
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    res.status(500).json({ error: "Error al actualizar rol" });
  }
});

router.get("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const data = doc.data() || {};
    const roleResolved = resolveRole(data);
    if (!isPanelAdminRole(roleResolved)) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const permisos = resolvePermisosForRole(roleResolved, data.permisos);
    if (data?.role !== roleResolved || JSON.stringify(normalizePermisos(data?.permisos)) !== JSON.stringify(permisos)) {
      await doc.ref.update({ role: roleResolved, permisos, updatedAt: new Date() });
    }
    res.json({ id: doc.id, ...data, role: roleResolved, permisos });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

router.patch("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { targetData, error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });

    const { nombre, activo } = req.body;
    const updates = {};
    if (nombre) updates.nombre = String(nombre).trim();
    if (req.user?.uid === uid && activo === false) {
      return res.status(400).json({ error: "No puede desactivar su propio usuario" });
    }
    if (activo === false && targetData.activo !== false && canManageUsers(targetData) && !(await hasOtherFullAdmin(uid))) {
      return res.status(400).json({ error: "No se puede desactivar el ultimo administrador con permiso de usuarios" });
    }
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Sin cambios" });

    await db.collection("users").doc(uid).update({ ...updates, updatedAt: new Date() });
    const authUpdate = {};
    if (updates.nombre) authUpdate.displayName = updates.nombre;
    if (activo !== undefined) authUpdate.disabled = !Boolean(activo);
    if (Object.keys(authUpdate).length > 0) {
      try { await admin.auth().updateUser(uid, authUpdate); } catch {}
    }

    res.json({ message: "Usuario actualizado" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

router.post("/:uid/deactivate", async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user?.uid === uid) return res.status(400).json({ error: "No puede desactivar su propio usuario" });
    const { targetData, error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });
    if (targetData.activo !== false && canManageUsers(targetData) && !(await hasOtherFullAdmin(uid))) {
      return res.status(400).json({ error: "No se puede desactivar el ultimo administrador con permiso de usuarios" });
    }

    await db.collection("users").doc(uid).update({ activo: false, updatedAt: new Date() });
    try { await admin.auth().updateUser(uid, { disabled: true }); } catch {}
    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    res.status(500).json({ error: "Error al desactivar usuario" });
  }
});

router.post("/:uid/activate", async (req, res) => {
  try {
    const { uid } = req.params;
    const { error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });

    await db.collection("users").doc(uid).update({ activo: true, updatedAt: new Date() });
    try { await admin.auth().updateUser(uid, { disabled: false }); } catch {}
    res.json({ message: "Usuario activado" });
  } catch (error) {
    console.error("Error al activar usuario:", error);
    res.status(500).json({ error: "Error al activar usuario" });
  }
});

router.post("/:uid/reset-password", async (req, res) => {
  try {
    const { uid } = req.params;
    const { targetData, error } = await assertAdminUserDoc(uid);
    if (error) return res.status(error.status).json({ error: error.message });
    const email = normalizeEmail(targetData?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "El usuario no tiene un email valido" });

    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ link });
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ error: "Error generando enlace" });
  }
});

export default router;
