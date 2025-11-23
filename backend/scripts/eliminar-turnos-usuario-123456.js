// Script para eliminar TODOS los turnos del usuario con IPT = 123456

import { db } from "../src/utils/firebase.js";

async function eliminarTurnosUsuario123456() {
  console.log("🗑️ Iniciando eliminación de turnos para usuario IPT = 123456");
  
  try {
    // Primero, necesitamos encontrar el productorId asociado al IPT 123456
    console.log("🔍 Buscando usuario con IPT = 123456...");
    
    const productoresSnapshot = await db.collection("productores")
      .where("ipt", "==", "123456")
      .get();
    
    if (productoresSnapshot.empty) {
      console.log("❌ No se encontró usuario con IPT = 123456");
      return;
    }
    
    const productorDoc = productoresSnapshot.docs[0];
    const productorId = productorDoc.id;
    const productorData = productorDoc.data();
    
    console.log("✅ Usuario encontrado:");
    console.log("  - ProductorId:", productorId);
    console.log("  - Nombre:", productorData.nombreCompleto || productorData.nombre);
    console.log("  - Email:", productorData.email);
    
    // Ahora buscar todos los turnos de este usuario
    console.log("🔍 Buscando turnos del usuario...");
    
    const turnosSnapshot = await db.collection("turnos")
      .where("productorId", "==", productorId)
      .get();
    
    if (turnosSnapshot.empty) {
      console.log("✅ No hay turnos para este usuario");
      return;
    }
    
    console.log(`📋 Se encontraron ${turnosSnapshot.size} turnos`);
    
    // Mostrar todos los turnos antes de eliminar
    console.log("📋 Turnos encontrados:");
    turnosSnapshot.forEach((doc, index) => {
      const turno = doc.data();
      console.log(`  ${index + 1}. ID: ${doc.id}`);
      console.log(`     Fecha: ${turno.fechaTurno || turno.fecha}`);
      console.log(`     Tipo: ${turno.tipoTurno}`);
      console.log(`     Estado: ${turno.estado}`);
      console.log(`     Activo: ${turno.activo}`);
      if (turno.motivo) console.log(`     Motivo: ${turno.motivo}`);
      console.log("");
    });
    
    // Confirmar antes de eliminar
    console.log("⚠️  Estás a punto de eliminar todos estos turnos.");
    console.log("¿Deseas continuar? (espera 3 segundos...)");
    
    // Esperar 3 segundos para dar tiempo de cancelar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("🗑️ Eliminando turnos...");
    
    // Eliminar todos los turnos
    const batch = db.batch();
    let contador = 0;
    
    turnosSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      contador++;
    });
    
    await batch.commit();
    
    console.log(`✅ ${contador} turnos eliminados exitosamente`);
    console.log("🎉 Proceso completado");
    
  } catch (error) {
    console.error("❌ Error al eliminar turnos:", error);
  }
}

// Ejecutar el script
eliminarTurnosUsuario123456();