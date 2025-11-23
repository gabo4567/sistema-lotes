// Script para eliminar TODOS los turnos del usuario con IPT = prod_123456

import { db } from "../src/utils/firebase.js";

async function eliminarTurnosUsuarioProd123456() {
  console.log("🗑️ Iniciando eliminación de turnos para usuario IPT = prod_123456");
  
  try {
    // Buscar por UID directamente ya que prod_123456 es un UID de Firebase
    const prodId = "prod_123456";
    console.log("🔍 Buscando turnos para UID:", prodId);
    
    // Buscar todos los turnos de este usuario por productorId
    const turnosSnapshot = await db.collection("turnos")
      .where("productorId", "==", prodId)
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
eliminarTurnosUsuarioProd123456();