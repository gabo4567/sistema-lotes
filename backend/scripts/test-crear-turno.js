// Script de prueba para verificar el guardado de turnos
// Este script simula la creación de un turno para probar el flujo

import { db } from '../src/utils/firebase.js';

async function testCrearTurno() {
  try {
    console.log('🧪 Iniciando prueba de creación de turno...');
    
    // Buscar el usuario con IPT 123456
    const usuariosSnapshot = await db.collection('productores')
      .where('ipt', '==', '123456')
      .get();
    
    if (usuariosSnapshot.empty) {
      console.log('❌ No se encontró ningún usuario con IPT 123456');
      return;
    }
    
    const usuario = usuariosSnapshot.docs[0];
    const usuarioId = usuario.id;
    const usuarioData = usuario.data();
    
    console.log(`✅ Usuario encontrado: ${usuarioData.nombreCompleto} (ID: ${usuarioId})`);
    
    // Crear un turno de prueba para el lunes 25-11-2024
    const turnoPrueba = {
      productorId: usuarioId,
      tipoTurno: 'insumo',
      fecha: '2024-11-25',
      fechaTurno: '2024-11-25',
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
      activo: true,
      motivo: 'Prueba de creación de turno'
    };
    
    console.log('📝 Creando turno de prueba:', turnoPrueba);
    
    const docRef = await db.collection('turnos').add(turnoPrueba);
    console.log(`✅ Turno creado exitosamente con ID: ${docRef.id}`);
    
    // Verificar que se guardó correctamente
    const turnoGuardado = await docRef.get();
    console.log('📋 Turno guardado:', turnoGuardado.data());
    
    // Limpiar - eliminar el turno de prueba
    await docRef.delete();
    console.log('🧹 Turno de prueba eliminado');
    
    console.log('🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testCrearTurno();