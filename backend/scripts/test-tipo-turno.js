// Script para probar que el tipo de turno se guarde correctamente

import fetch from 'node-fetch';

const API_URL = "http://localhost:3000/api";

// Simular diferentes tipos de turno
const tiposDePrueba = [
  { input: "Insumo", esperado: "insumo" },
  { input: "insumo", esperado: "insumo" },
  { input: "Renovación de Carnet", esperado: "carnet" },
  { input: "Renovacion de Carnet", esperado: "carnet" },
  { input: "renovación", esperado: "carnet" },
  { input: "renov", esperado: "carnet" },
  { input: "Otra", esperado: "otra" },
  { input: "otra", esperado: "otra" }
];

async function probarNormalizacion() {
  console.log("🧪 Probando normalización de tipos de turno...\n");
  
  for (const prueba of tiposDePrueba) {
    const body = {
      ipt: "123456",
      fechaSolicitada: "2024-11-26",
      tipoTurno: prueba.input,
      motivo: `Prueba de tipo: ${prueba.input}`
    };
    
    console.log(`📤 Enviando: "${prueba.input}"`);
    
    try {
      const resp = await fetch(`${API_URL}/test/test-turno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      });
      
      const data = await resp.json();
      
      if (data.success && data.turno) {
        const resultado = data.turno.tipoTurno;
        const exito = resultado === prueba.esperado;
        console.log(`✅ Resultado: "${resultado}" | Esperado: "${prueba.esperado}" | ${exito ? '✅ ÉXITO' : '❌ FALLÓ'}`);
      } else {
        console.log(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      console.log(`❌ Error de red: ${error.message}`);
    }
    
    console.log(""); // Línea en blanco
  }
  
  console.log("🎯 Prueba completada");
}

probarNormalizacion();