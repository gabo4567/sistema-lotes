// Script para verificar claims específicos de prod_123456
import { admin } from '../src/utils/firebase.js';

async function verificarClaimsProd123456() {
  try {
    console.log("🔍 Verificando claims de prod_123456...");
    
    // Obtener usuario específico
    const user = await admin.auth().getUser('prod_123456');
    
    console.log(`👤 Usuario UID: ${user.uid}`);
    console.log(`   - Email: ${user.email || 'Sin email'}`);
    console.log(`   - Display Name: ${user.displayName || 'Sin nombre'}`);
    console.log(`   - Custom Claims:`, user.customClaims || {});
    
    if (user.customClaims?.ipt) {
      console.log(`   ✅ IPT en claims: ${user.customClaims.ipt}`);
    } else {
      console.log(`   ❌ Sin IPT en claims`);
    }
    
    // También verificar en Firestore
    console.log("\n🔍 Verificando en Firestore...");
    
    // Buscar por IPT
    const snapByIpt = await admin.firestore().collection('productores').where('ipt', '==', '123456').get();
    if (!snapByIpt.empty) {
      const doc = snapByIpt.docs[0];
      console.log(`📄 Documento encontrado por IPT:`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Datos:`, doc.data());
    }
    
    // Buscar por UID
    const docByUid = await admin.firestore().collection('productores').doc('prod_123456').get();
    if (docByUid.exists) {
      console.log(`📄 Documento encontrado por UID:`);
      console.log(`   - ID: ${docByUid.id}`);
      console.log(`   - Datos:`, docByUid.data());
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verificarClaimsProd123456().then(() => {
  console.log("\n✅ Verificación completada");
  process.exit(0);
});