// Script para verificar la estructura de usuarios y sus IPT
import { db } from '../src/utils/firebase.js';

async function verificarEstructuraUsuarios() {
  try {
    console.log("🔍 Verificando estructura de usuarios...");
    
    // Obtener algunos usuarios
    const usersSnapshot = await db.collection('productores').limit(10).get();
    
    console.log(`📊 Se encontraron ${usersSnapshot.size} usuarios`);
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n👤 Usuario ID: ${doc.id}`);
      console.log(`   - Nombre: ${data.nombre || 'Sin nombre'}`);
      console.log(`   - Email: ${data.email || 'Sin email'}`);
      console.log(`   - IPT: ${data.ipt || 'Sin IPT'}`);
      console.log(`   - UID Firebase: ${data.uid || 'Sin UID'}`);
      console.log(`   - Datos completos:`, JSON.stringify(data, null, 2));
    });
    
    // Verificar turnos para entender la relación
    console.log("\n" + "=".repeat(50));
    console.log("🔍 Verificando turnos y sus productorId...");
    
    const turnosSnapshot = await db.collection('turnos').limit(5).get();
    
    turnosSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n📅 Turno ID: ${doc.id}`);
      console.log(`   - ProductorId: ${data.productorId}`);
      console.log(`   - Tipo: ${data.tipoTurno}`);
      console.log(`   - Fecha: ${data.fecha}`);
      console.log(`   - Estado: ${data.estado}`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verificarEstructuraUsuarios().then(() => {
  console.log("\n✅ Verificación completada");
  process.exit(0);
});