// Script para verificar los claims de Firebase del usuario actual
import { admin, db } from '../src/utils/firebase.js';

async function verificarClaimsUsuario() {
  try {
    console.log("🔍 Verificando claims de usuarios...");
    
    // Buscar usuario por IPT 123456
    const usersSnapshot = await admin.auth().listUsers(100);
    
    console.log(`📊 Se encontraron ${usersSnapshot.users.length} usuarios en Firebase Auth`);
    
    usersSnapshot.users.forEach(user => {
      console.log(`\n👤 Usuario UID: ${user.uid}`);
      console.log(`   - Email: ${user.email || 'Sin email'}`);
      console.log(`   - Display Name: ${user.displayName || 'Sin nombre'}`);
      console.log(`   - Custom Claims:`, user.customClaims || {});
      
      // Verificar si tiene IPT en claims
      if (user.customClaims?.ipt) {
        console.log(`   ✅ IPT en claims: ${user.customClaims.ipt}`);
      } else {
        console.log(`   ❌ Sin IPT en claims`);
      }
    });
    
    // Buscar específicamente usuario con IPT 123456
    console.log("\n" + "=".repeat(50));
    console.log("🔍 Buscando usuario con IPT 123456...");
    
    const userWithIpt123456 = usersSnapshot.users.find(user => user.customClaims?.ipt === '123456');
    
    if (userWithIpt123456) {
      console.log(`✅ Encontrado usuario con IPT 123456:`);
      console.log(`   - UID: ${userWithIpt123456.uid}`);
      console.log(`   - Email: ${userWithIpt123456.email}`);
      console.log(`   - Claims:`, userWithIpt123456.customClaims);
    } else {
      console.log("❌ No se encontró usuario con IPT 123456 en Firebase Auth");
      console.log("💡 Esto significa que el IPT 123456 solo existe en Firestore, no en Firebase Auth");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verificarClaimsUsuario().then(() => {
  console.log("\n✅ Verificación de claims completada");
  process.exit(0);
});