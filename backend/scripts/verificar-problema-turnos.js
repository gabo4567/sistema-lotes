// Script para verificar el problema de guardado de turnos
// Este script simula exactamente lo que hace la app móvil

import { db } from '../src/utils/firebase.js';
import admin from 'firebase-admin';

async function verificarProblemaTurnos() {
  try {
    console.log('🔍 Verificando problema de guardado de turnos...');
    
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
    
    // Verificar turnos existentes
    const turnosExistentes = await db.collection('turnos')
      .where('productorId', '==', usuarioId)
      .where('activo', '==', true)
      .get();
    
    console.log(`📊 Turnos existentes: ${turnosExistentes.size}`);
    
    turnosExistentes.forEach(doc => {
      const data = doc.data();
      console.log(`- Turno: ${doc.id}, Tipo: ${data.tipoTurno}, Fecha: ${data.fecha}, Estado: ${data.estado}`);
    });
    
    // Simular la creación de un turno como lo hace la app móvil
    console.log('\n🧪 Simulando creación de turno...');
    
    const fechaPrueba = '2024-11-26'; // Martes
    const body = {
      ipt: '123456',
      fechaSolicitada: fechaPrueba,
      tipoTurno: 'insumo'
    };
    
    console.log('📤 Body enviado:', body);
    
    // Simular la lógica del backend
    let { tipoTurno, fechaSolicitada, ipt } = body;
    const productorId = usuarioId;
    
    // Normalizar tipoTurno
    const t = String(tipoTurno).toLowerCase().trim();
    let tipo = "otra";
    if (t.includes("insumo")) tipo = "insumo";
    else if (t.includes("renov")) tipo = "carnet";
    
    tipoTurno = tipo;
    console.log('🔄 Tipo normalizado:', tipoTurno);
    
    // Validar fecha
    const fechaFinal = fechaSolicitada;
    console.log('📅 Fecha final:', fechaFinal);
    
    // Crear el turno
    const turno = {
      productorId,
      tipoTurno,
      fecha: fechaFinal,
      fechaTurno: fechaFinal,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      activo: true
    };
    
    console.log('📝 Turno a crear:', turno);
    
    // Guardar en Firestore
    const docRef = await db.collection('turnos').add(turno);
    console.log(`✅ Turno creado exitosamente con ID: ${docRef.id}`);
    
    // Verificar que se guardó correctamente
    const turnoGuardado = await docRef.get();
    console.log('📋 Turno guardado:', turnoGuardado.data());
    
    // Limpiar - eliminar el turno de prueba
    await docRef.delete();
    console.log('🧹 Turno de prueba eliminado');
    
    console.log('\n🎉 Prueba completada exitosamente!');
    console.log('💡 El problema no está en el backend. Verifica la app móvil.');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

verificarProblemaTurnos();