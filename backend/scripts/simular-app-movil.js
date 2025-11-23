// Script completo para simular la app móvil
import { db } from '../src/utils/firebase.js';
import fetch from 'node-fetch';

// Simular el comportamiento exacto de la app móvil
async function simularAppMovil() {
  console.log('📱 Simulando app móvil completa...');
  
  try {
    // 1. Buscar usuario con IPT 123456
    console.log('1️⃣ Buscando usuario con IPT 123456...');
    const usuariosSnapshot = await db.collection('productores')
      .where('ipt', '==', '123456')
      .get();
    
    if (usuariosSnapshot.empty) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const usuario = usuariosSnapshot.docs[0];
    const usuarioData = usuario.data();
    console.log(`✅ Usuario encontrado: ${usuarioData.nombreCompleto}`);
    
    // 2. Simular el token de Firebase (en realidad vendría de la app)
    console.log('2️⃣ Simulando token de autenticación...');
    // En producción, este token vendría de Firebase Auth
    
    // 3. Probar disponibilidad
    console.log('3️⃣ Probando disponibilidad...');
    const fechaPrueba = '26-11-2024'; // Martes
    const tipoPrueba = 'Insumo';
    
    // Convertir fecha como lo hace la app
    const toIso = (s) => {
      console.log("🔄 Convirtiendo fecha:", s);
      const m = String(s).trim().match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
      console.log("📅 Match regex:", m);
      if (!m) return null;
      const dd = m[1], mm = m[2], yyyy = m[3];
      const result = `${yyyy}-${mm}-${dd}`;
      console.log("✅ Fecha ISO resultante:", result);
      return result;
    };
    
    const fechaIso = toIso(fechaPrueba);
    if (!fechaIso) {
      console.log('❌ Fecha inválida');
      return;
    }
    
    // Validar fin de semana
    const fecha = new Date(fechaIso);
    const diaSemana = fecha.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      console.log('❌ Es fin de semana');
      return;
    }
    
    // Preparar tipo como lo hace la app
    const tipoParam = tipoPrueba.toLowerCase().includes('insumo') ? 'insumo' : 
                     tipoPrueba.toLowerCase().includes('renov') ? 'carnet' : 'otra';
    
    console.log('📤 Disponibilidad - Tipo normalizado:', tipoParam);
    console.log('📤 Disponibilidad - Fecha ISO:', fechaIso);
    console.log('📤 Disponibilidad - IPT:', '123456');
    
    // 4. Crear turno como lo hace la app
    console.log('4️⃣ Creando turno...');
    const body = {
      ipt: '123456',
      fechaSolicitada: fechaIso,
      tipoTurno: tipoParam
    };
    
    console.log('📤 Body del request:', JSON.stringify(body, null, 2));
    
    // 5. Simular la llamada al backend
    console.log('5️⃣ Llamando al backend...');
    
    // Crear turno directamente en la base de datos (simulando backend)
    const turno = {
      productorId: usuario.id,
      tipoTurno: body.tipoTurno,
      fecha: body.fechaSolicitada,
      fechaTurno: body.fechaSolicitada,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      activo: true
    };
    
    console.log('📝 Turno a crear:', turno);
    
    const docRef = await db.collection('turnos').add(turno);
    console.log(`✅ Turno creado exitosamente con ID: ${docRef.id}`);
    
    // Verificar que se guardó
    const turnoGuardado = await docRef.get();
    console.log('📋 Turno guardado:', turnoGuardado.data());
    
    // 6. Verificar que aparece en la lista
    console.log('6️⃣ Verificando que aparece en la lista...');
    const turnosList = await db.collection('turnos')
      .where('productorId', '==', usuario.id)
      .where('activo', '==', true)
      .get();
    
    console.log(`📊 Turnos encontrados en lista: ${turnosList.size}`);
    turnosList.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}, Tipo: ${data.tipoTurno}, Fecha: ${data.fecha}`);
    });
    
    // Limpiar
    await docRef.delete();
    console.log('🧹 Turno de prueba eliminado');
    
    console.log('\n🎉 Simulación completada exitosamente!');
    console.log('💡 El problema debe estar en la comunicación entre app y backend');
    
  } catch (error) {
    console.error('❌ Error en simulación:', error);
  }
}

simularAppMovil();