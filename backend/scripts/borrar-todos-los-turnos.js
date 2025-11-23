// Script para borrar TODOS los turnos de TODOS los usuarios
import { db } from '../src/utils/firebase.js';

async function borrarTodosLosTurnos() {
  try {
    console.log("🗑️  Iniciando eliminación de TODOS los turnos...");
    
    // Obtener todos los turnos
    const turnosSnapshot = await db.collection('turnos').get();
    console.log(`📊 Se encontraron ${turnosSnapshot.size} turnos`);
    
    if (turnosSnapshot.size === 0) {
      console.log("✅ No hay turnos para eliminar");
      return;
    }
    
    // Mostrar detalles de los turnos antes de eliminar
    const turnosInfo = [];
    turnosSnapshot.forEach(doc => {
      const data = doc.data();
      turnosInfo.push({
        id: doc.id,
        productorId: data.productorId,
        tipoTurno: data.tipoTurno,
        fecha: data.fecha,
        ipt: data.ipt,
        estado: data.estado
      });
    });
    
    console.log("📋 Turnos encontrados:");
    turnosInfo.forEach(turno => {
      console.log(`  - ID: ${turno.id}, Productor: ${turno.productorId}, Tipo: ${turno.tipoTurno}, Fecha: ${turno.fecha}, IPT: ${turno.ipt}, Estado: ${turno.estado}`);
    });
    
    // Confirmar antes de eliminar
    console.log("\n⚠️  ESTO BORRARÁ TODOS LOS TURNOS");
    
    // Eliminar todos los documentos por lotes
    const batch = db.batch();
    let eliminados = 0;
    
    turnosSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      eliminados++;
      
      // Ejecutar batch cada 500 documentos (límite de Firestore)
      if (eliminados % 500 === 0) {
        console.log(`🗑️  Eliminando lote de 500 turnos...`);
      }
    });
    
    await batch.commit();
    console.log(`✅ Se eliminaron ${eliminados} turnos exitosamente`);
    
  } catch (error) {
    console.error("❌ Error al eliminar turnos:", error);
    process.exit(1);
  }
}

// Ejecutar el script
borrarTodosLosTurnos().then(() => {
  console.log("🎉 Script completado");
  process.exit(0);
});