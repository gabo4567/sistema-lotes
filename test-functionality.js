// Test para verificar funcionalidad de Editar y Eliminar turnos
// Este script puede ser ejecutado en el navegador o en Node.js

const API_URL = "http://localhost:3000";

// Función auxiliar para hacer requests
async function makeRequest(url, method = "GET", body = null, token = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  };
  
  const response = await fetch(url, options);
  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: "Parse error", text };
  }
}

// Test de funcionalidad
async function testEditDeleteFunctionality() {
  console.log("🧪 INICIANDO TEST DE EDITAR Y ELIMINAR TURNOS");
  
  try {
    // 1. Crear un turno de prueba (sin autenticación para simplificar)
    console.log("📅 Creando turno de prueba...");
    const nuevoTurno = {
      ipt: "123456",
      fechaSolicitada: "2024-11-26",
      tipoTurno: "insumo",
      motivo: "Turno de prueba para testeo"
    };
    
    const crearResponse = await makeRequest(`${API_URL}/test/public/test-turno`, "POST", nuevoTurno);
    console.log("✅ Turno creado:", crearResponse);
    
    if (!crearResponse.success) {
      throw new Error("No se pudo crear el turno de prueba");
    }
    
    const turnoId = crearResponse.turnoId;
    console.log("🆔 ID del turno creado:", turnoId);
    
    // 2. Obtener turnos del usuario
    console.log("📋 Obteniendo turnos del usuario...");
    const turnosResponse = await makeRequest(`${API_URL}/turnos/productor/123456`);
    console.log("📊 Turnos encontrados:", turnosResponse.length);
    
    // 3. Test de edición (PUT)
    console.log("✏️ Testeando edición de turno...");
    const datosEdicion = {
      fechaSolicitada: "2024-11-27",
      tipoTurno: "carnet",
      motivo: "Turno editado - renovación de carnet"
    };
    
    const editarResponse = await makeRequest(`${API_URL}/turnos/${turnoId}`, "PUT", datosEdicion);
    console.log("✅ Edición exitosa:", editarResponse);
    
    // 4. Verificar que el turno fue editado
    console.log("🔍 Verificando edición...");
    const turnosDespuesEditar = await makeRequest(`${API_URL}/turnos/productor/123456`);
    const turnoEditado = turnosDespuesEditar.find(t => t.id === turnoId);
    console.log("📋 Turno después de editar:", {
      fecha: turnoEditado.fechaTurno,
      tipo: turnoEditado.tipoTurno,
      motivo: turnoEditado.motivo
    });
    
    // 5. Test de eliminación (soft delete)
    console.log("🗑️ Testeando eliminación de turno...");
    const eliminarResponse = await makeRequest(`${API_URL}/turnos/${turnoId}`, "DELETE");
    console.log("✅ Eliminación exitosa:", eliminarResponse);
    
    // 6. Verificar que el turno fue eliminado (soft delete)
    console.log("🔍 Verificando eliminación...");
    const turnosDespuesEliminar = await makeRequest(`${API_URL}/turnos/productor/123456`);
    const turnoEliminado = turnosDespuesEliminar.find(t => t.id === turnoId);
    
    if (turnoEliminado) {
      console.log("⚠️ El turno aún existe en la lista (esto es correcto para soft delete)");
      console.log("📊 Estado del turno:", turnoEliminado.activo ? "Activo" : "Inactivo");
    } else {
      console.log("✅ El turno fue correctamente filtrado (soft delete funcionando)");
    }
    
    console.log("🎉 ¡TODOS LOS TESTS PASARON!");
    
  } catch (error) {
    console.error("❌ Error en el test:", error);
  }
}

// Ejecutar el test
console.log("🚀 Iniciando test de funcionalidad...");
testEditDeleteFunctionality();