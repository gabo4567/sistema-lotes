import readline from "node:readline";
import { admin, db } from "../utils/firebase.js";

// ⚠️ CONFIGURAR ESTO SÍ O SÍ
const KEEP_IPTS = new Set(["123456", "654321"]);

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const yes = args.has("--yes");

if (KEEP_IPTS.size === 0) {
  console.error("❌ ERROR: KEEP_IPTS está vacío. Abortando.");
  process.exit(1);
}

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const askConfirm = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) =>
    rl.question(question, resolve)
  );

  rl.close();
  return String(answer || "").trim();
};

const deleteRefsInBatches = async (refs, label) => {
  if (!refs.length) return 0;

  const parts = chunk(refs, 450);
  let deleted = 0;

  for (const part of parts) {
    const batch = db.batch();
    part.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += part.length;
  }

  console.log(`🗑️ [DELETE] ${label}: ${deleted}`);
  return deleted;
};

const collectDocRefs = async (query) => {
  try {
    const snap = await query.get();
    return snap.docs.map((d) => d.ref);
  } catch (e) {
    console.log("⚠️ Error consultando colección:", e?.message || e);
    return [];
  }
};

const uniqRefs = (refs) => {
  const map = new Map();
  refs.forEach((r) => map.set(r.path, r));
  return Array.from(map.values());
};

const safeDeleteAuthUser = async (uid) => {
  try {
    await admin.auth().deleteUser(uid);
    console.log(`🔐 [AUTH] eliminado uid=${uid}`);
    return true;
  } catch (e) {
    if (e?.code === "auth/user-not-found") {
      console.log(`🔐 [AUTH] no existe uid=${uid}`);
      return false;
    }
    console.log(`❌ [AUTH] error eliminando uid=${uid}:`, e?.message || e);
    return false;
  }
};

const normalizeIpt = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const main = async () => {
  console.log(`\n🚀 Modo: ${execute ? "EJECUCIÓN" : "DRY-RUN"}`);
  console.log(`📌 IPT a conservar: ${Array.from(KEEP_IPTS).join(", ")}\n`);

  const productoresSnap = await db.collection("productores").get();

  const productores = productoresSnap.docs.map((d) => ({
    ref: d.ref,
    id: d.id,
    data: d.data(),
  }));

  const keep = [];
  const toDelete = [];

  for (const p of productores) {
    const ipt = normalizeIpt(p.data?.ipt);

    if (!ipt) {
      console.log(`⚠️ [WARN] productor sin IPT → docId=${p.id}`);
    }

    if (KEEP_IPTS.has(ipt)) {
      keep.push({ ...p, ipt });
    } else {
      toDelete.push({ ...p, ipt });
    }
  }

  // 🔥 VALIDACIÓN CRÍTICA (ANTI-BORRADO MASIVO)
  const missingIPTs = Array.from(KEEP_IPTS).filter(
    (ipt) => !keep.some((p) => p.ipt === ipt)
  );

  if (missingIPTs.length > 0) {
    console.error("\n❌ ERROR: No se encontraron los IPT a conservar:");
    missingIPTs.forEach((ipt) => console.error(` - ${ipt}`));
    console.error("🛑 Abortando para evitar borrar todo.");
    process.exit(1);
  }

  if (keep.length !== KEEP_IPTS.size) {
    console.error("\n❌ ERROR: cantidad de productores a conservar no coincide.");
    process.exit(1);
  }

  console.log(`📊 Total productores: ${productores.length}`);
  console.log(`✅ A conservar: ${keep.length}`);
  console.log(`❌ A eliminar: ${toDelete.length}\n`);

  keep.forEach((p) =>
    console.log(`🟢 KEEP → ipt=${p.ipt} docId=${p.id}`)
  );

  toDelete.slice(0, 20).forEach((p) =>
    console.log(`🔴 DEL → ipt=${p.ipt || "(vacío)"} docId=${p.id}`)
  );

  if (toDelete.length > 20) {
    console.log(`... +${toDelete.length - 20} más`);
  }

  if (execute && !yes) {
    const answer = await askConfirm(
      '\n⚠️ Confirmación requerida. Escribí "BORRAR" para continuar: '
    );

    if (answer !== "BORRAR") {
      console.log("❌ Cancelado.");
      process.exit(0);
    }
  }

  let total = {
    productores: 0,
    turnos: 0,
    lotes: 0,
    asignaciones: 0,
    ordenes: 0,
    ingresos: 0,
    users: 0,
    auth: 0,
  };

  for (const p of toDelete) {
    const ipt = normalizeIpt(p.ipt);
    const docId = p.id;
    const authUid = ipt ? `prod_${ipt}` : null;

    console.log(`\n🔄 Procesando → IPT=${ipt || "(vacío)"} | docId=${docId}`);

    const turnoRefs = uniqRefs([
      ...(await collectDocRefs(db.collection("turnos").where("productorId", "==", docId))),
      ...(authUid ? await collectDocRefs(db.collection("turnos").where("productorId", "==", authUid)) : []),
      ...(ipt ? await collectDocRefs(db.collection("turnos").where("ipt", "==", ipt)) : []),
    ]);

    const loteRefs = uniqRefs(
      ipt ? await collectDocRefs(db.collection("lotes").where("ipt", "==", ipt)) : []
    );

    const asignRefs = uniqRefs([
      ...(await collectDocRefs(db.collection("productorInsumos").where("productorId", "==", docId))),
      ...(authUid ? await collectDocRefs(db.collection("productorInsumos").where("productorId", "==", authUid)) : []),
    ]);

    const ordenRefs = uniqRefs([
      ...(await collectDocRefs(db.collection("ordenes").where("productorId", "==", docId))),
      ...(authUid ? await collectDocRefs(db.collection("ordenes").where("productorId", "==", authUid)) : []),
    ]);

    const ingresoRefs = uniqRefs([
      ...(await collectDocRefs(db.collection("ingresosProductor").where("productorId", "==", docId))),
      ...(ipt ? await collectDocRefs(db.collection("ingresosProductor").where("ipt", "==", ipt)) : []),
    ]);

    const userRef = authUid ? db.collection("users").doc(authUid) : null;
    const userSnap = userRef ? await userRef.get() : null;

    console.log(
      `[PLAN] turnos=${turnoRefs.length}, lotes=${loteRefs.length}, asign=${asignRefs.length}, ordenes=${ordenRefs.length}, ingresos=${ingresoRefs.length}, userDoc=${userSnap?.exists ? 1 : 0}, auth=${authUid ? 1 : 0}`
    );

    if (!execute) continue;

    total.turnos += await deleteRefsInBatches(turnoRefs, "turnos");
    total.lotes += await deleteRefsInBatches(loteRefs, "lotes");
    total.asignaciones += await deleteRefsInBatches(asignRefs, "asignaciones");
    total.ordenes += await deleteRefsInBatches(ordenRefs, "ordenes");
    total.ingresos += await deleteRefsInBatches(ingresoRefs, "ingresos");

    if (userSnap?.exists) {
      await userRef.delete();
      total.users++;
      console.log(`🗑️ users/${authUid}`);
    }

    if (authUid) {
      if (await safeDeleteAuthUser(authUid)) {
        total.auth++;
      }
    }

    await p.ref.delete();
    total.productores++;

    console.log(`🗑️ productores/${docId}`);
  }

  console.log("\n📦 RESUMEN FINAL");

  if (!execute) {
    console.log("👉 DRY-RUN: no se eliminó nada.");
    return;
  }

  console.log(total);
};

main().catch((e) => {
  console.error("❌ Error en cleanup:", e);
  process.exit(1);
});