// Script para actualizar los claims del usuario prod_123456 con el IPT correcto
import { admin, db } from '../src/utils/firebase.js';

async function actualizarClaimsUsuario() {
  try {
    console.log("🔍 Actualizando claims de prod_123456...");
    
    // Buscar el documento del productor con IPT 123456
    const snapByIpt = await db.collection('productores').where('ipt', '==', '123456').get();
    
    if (snapByIpt.empty) {
      console.log("❌ No se encontró productor con IPT 123456");
      return;
    }
    
    const docProductor = snapByIpt.docs[0];
    const dataProductor = docProductor.data();
    
    console.log(`📄 Productor encontrado:`);
    console.log(`   - ID: ${docProductor.id}`);
    console.log(`   - Nombre: ${dataProductor.nombreCompleto || dataProductor.nombre}`);
    console.log(`   - IPT: ${dataProductor.ipt}`);
    console.log(`   - Email: ${dataProductor.email}`);
    
    // Actualizar claims del usuario en Firebase Auth
    await admin.auth().setCustomUserClaims('prod_123456', {
      ipt: dataProductor.ipt,
      role: 'productor',
      nombre: dataProductor.nombreCompleto || dataProductor.nombre,
      email: dataProductor.email
    });
    
    console.log(`✅ Claims actualizados para prod_123456:`);
    console.log(`   - IPT: ${dataProductor.ipt}`);
    console.log(`   - Role: productor`);
    console.log(`   - Nombre: ${dataProductor.nombreCompleto || dataProductor.nombre}`);
    
    // Verificar que se actualizaron correctamente
    const updatedUser = await admin.auth().getUser('prod_123456');
    console.log(`🔍 Claims actualizados:`, updatedUser.customClaims);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

actualizarClaimsUsuario().then(() => {
  console.log("\n✅ Actualización de claims completada");
  process.exit(0);
});