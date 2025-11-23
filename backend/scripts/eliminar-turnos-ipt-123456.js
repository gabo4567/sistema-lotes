import { db } from '../src/utils/firebase.js';
import admin from 'firebase-admin';

async function eliminarTurnosPorIPT() {
  try {
    console.log('🔍 Buscando turnos del usuario con IPT 123456...');
    
    // Primero buscar el usuario con IPT 123456
    const usuariosSnapshot = await db.collection('productores')
      .where('ipt', '==', '123456')
      .get();
    
    if (usuariosSnapshot.empty) {
      console.log('❌ No se encontró ningún usuario con IPT 123456');
      return;
    }
    
    const usuario = usuariosSnapshot.docs[0];
    const usuarioId = usuario.id;
    console.log(`✅ Usuario encontrado: ${usuarioId}`);
    console.log(`📋 Datos del usuario:`, usuario.data());
    
    // Buscar todos los turnos de este usuario
    const turnosSnapshot = await db.collection('turnos')
      .where('productorId', '==', usuarioId)
      .get();
    
    if (turnosSnapshot.empty) {
      console.log('📭 No se encontraron turnos para este usuario');
      return;
    }
    
    console.log(`📊 Se encontraron ${turnosSnapshot.size} turnos`);
    
    // Mostrar los turnos antes de eliminar
    const turnos = [];
    turnosSnapshot.forEach(doc => {
      const data = doc.data();
      turnos.push({
        id: doc.id,
        tipoTurno: data.tipoTurno,
        fecha: data.fecha,
        fechaTurno: data.fechaTurno,
        estado: data.estado,
        motivo: data.motivo || 'Sin motivo'
      });
    });
    
    console.log('📋 Turnos encontrados:');
    console.table(turnos);
    
    // Confirmar antes de eliminar
    console.log('⚠️  ¿Deseas eliminar estos turnos? (s/n)');
    
    // En un script real, aquí habría una confirmación
    // Por ahora, procedemos con la eliminación
    
    let eliminados = 0;
    for (const doc of turnosSnapshot.docs) {
      await db.collection('turnos').doc(doc.id).delete();
      eliminados++;
      console.log(`🗑️  Turno eliminado: ${doc.id}`);
    }
    
    console.log(`✅ Se eliminaron ${eliminados} turnos exitosamente`);
    
  } catch (error) {
    console.error('❌ Error al eliminar turnos:', error);
  }
}

// Ejecutar el script
eliminarTurnosPorIPT();