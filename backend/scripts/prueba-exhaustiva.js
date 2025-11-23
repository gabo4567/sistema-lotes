// Script de prueba exhaustiva para verificar fecha y tipo de turno

import fetch from 'node-fetch';

const API_URL = "http://localhost:3000/api";

// Pruebas de fecha y tipo
const pruebas = [
  {
    nombre: "Renovación de Carnet - 10-04-2026",
    data: {
      ipt: "123456",
      fechaSolicitada: "2026-04-10",
      tipoTurno: "Renovación de Carnet",
      motivo: "Prueba de fecha y tipo"
    },
    esperado: {
      tipo: "carnet",
      fecha: "2026-04-10"
    }
  },
  {
    nombre: "Insumo - 15-05-2026", 
    data: {
      ipt: "123456",
      fechaSolicitada: "2026-05-15",
      tipoTurno: "Insumo",
      motivo: "Prueba de insumo"
    },
    esperado: {
      tipo: "insumo",
      fecha: "2026-05-15"
    }
  },
  {
    nombre: "Otra - 20-06-2026",
    data: {
      ipt: "123456", 
      fechaSolicitada: "2026-06-20",
      tipoTurno: "Otra",
      motivo: "Prueba de otra"
    },
    esperado: {
      tipo: "otra",
      fecha: "2026-06-20"
    }
  }
];

async function ejecutarPrueba(prueba) {
  console.log(`\n🧪 ${prueba.nombre}`);
  console.log("📤 Enviando:", JSON.stringify(prueba.data, null, 2));
  
  try {
    const resp = await fetch(`${API_URL}/test/test-turno`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(prueba.data)
    });
    
    const data = await resp.json();
    console.log("📥 Respuesta:", JSON.stringify(data, null, 2));
    
    if (data.success && data.turno) {
      const turno = data.turno;
      const tipoCorrecto = turno.tipoTurno === prueba.esperado.tipo;
      const fechaCorrecta = turno.fechaTurno === prueba.esperado.fecha;
      
      console.log(`✅ Tipo: ${turno.tipoTurno} (esperado: ${prueba.esperado.tipo}) - ${tipoCorrecto ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
      console.log(`✅ Fecha: ${turno.fechaTurno} (esperado: ${prueba.esperado.fecha}) - ${fechaCorrecta ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
      
      if (tipoCorrecto && fechaCorrecta) {
        console.log("🎉 PRUEBA EXITOSA");
      } else {
        console.log("❌ PRUEBA FALLIDA");
      }
    } else {
      console.log("❌ Error en respuesta:", data.message);
    }
    
  } catch (error) {
    console.log("❌ Error de red:", error.message);
  }
}

async function ejecutarTodasLasPruebas() {
  console.log("🚀 INICIANDO PRUEBAS EXHAUSTIVAS");
  console.log("=" .repeat(50));
  
  for (const prueba of pruebas) {
    await ejecutarPrueba(prueba);
    // Esperar 1 segundo entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("🏁 PRUEBAS COMPLETADAS");
}

ejecutarTodasLasPruebas();