// Script para eliminar TODAS las mediciones del productor "test123"

import { db } from "../src/utils/firebase.js";

async function eliminarMedicionesProductorTest123() {
  console.log("🗑️ Iniciando eliminación de mediciones para productor = test123");

  try {
    const productor = "test123";
    console.log("🔍 Buscando mediciones para productor:", productor);

    const snapshot = await db
      .collection("mediciones")
      .where("productor", "==", productor)
      .get();

    if (snapshot.empty) {
      console.log("✅ No hay mediciones para este productor");
      return;
    }

    console.log(`📋 Se encontraron ${snapshot.size} mediciones`);
    console.log("📋 Mediciones encontradas:");
    snapshot.forEach((doc, index) => {
      const m = doc.data();
      console.log(`  ${index + 1}. ID: ${doc.id}`);
      console.log(`     Fecha: ${m.fecha}`);
      console.log(`     Tipo: ${m.tipo}`);
      console.log(`     Lote: ${m.lote}`);
      console.log(`     Activo: ${m.activo}`);
      if (m.observaciones) console.log(`     Observaciones: ${m.observaciones}`);
      console.log("");
    });

    console.log("⚠️  Estás a punto de eliminar todas estas mediciones.");
    console.log("¿Deseas continuar? (espera 2 segundos...)");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("🗑️ Eliminando mediciones...");
    const batch = db.batch();
    let contador = 0;
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      contador++;
    });

    await batch.commit();
    console.log(`✅ ${contador} mediciones eliminadas exitosamente`);
    console.log("🎉 Proceso completado");
  } catch (error) {
    console.error("❌ Error al eliminar mediciones:", error);
  }
}

eliminarMedicionesProductorTest123();

