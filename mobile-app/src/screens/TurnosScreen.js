// mobile-app/src/screens/TurnosScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function TurnosScreen() {
  const [fechaInput, setFechaInput] = useState("");
  const [tipo, setTipo] = useState("");
  const [mostrarTipos, setMostrarTipos] = useState(false);
  const tipoOptions = ["Insumo", "Renovación de Carnet", "Otra"];
  const [disp, setDisp] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [motivo, setMotivo] = useState("");
  const [view, setView] = useState("list");
  const [turnoEditando, setTurnoEditando] = useState(null);
  const insets = useSafeAreaInsets();

  const loadList = async () => {
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const uid = auth.currentUser?.uid;
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!uid || !idToken) return;
      
      // Usar el productorId de los claims si está disponible, sino usar el UID
      const productorId = tokenResult?.claims?.productorId || uid;
      console.log("📋 Cargando turnos para productorId:", productorId);
      console.log("🔍 UID de Firebase:", uid);
      console.log("📄 Claims:", tokenResult?.claims);
      
      const resp = await fetch(`${API_URL}/turnos/productor/${productorId}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const responseText = await resp.text();
      console.log("📡 Respuesta cruda de turnos:", responseText);
      
      let j;
      try {
        j = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Error parseando JSON de turnos:", e);
        setList([]);
        return;
      }
      
      console.log("📋 Turnos obtenidos:", j);
      setList(Array.isArray(j) ? j : []);
    } catch (error) {
      console.error("❌ Error cargando turnos:", error);
      setList([]);
    }
  };

  useEffect(() => { 
    loadList(); 
    // Test de conectividad
    testBackendConnection();
  }, []);
  
  const testBackendConnection = async () => {
    try {
      console.log("🧪 Testeando conexión con backend...");
      const resp = await fetch(`${API_URL}/turnos/ping`);
      const data = await resp.json();
      console.log("✅ Conexión exitosa:", data);
    } catch (error) {
      console.error("❌ Error de conexión:", error);
    }
  };
  
  const testFlujoTurno = async () => {
    try {
      console.log("🧪 Testeando flujo completo de turno...");
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        console.error("❌ No hay token de autenticación");
        return;
      }
      
      const body = {
        fechaSolicitada: "2024-11-26",
        tipoTurno: "insumo",
        ipt: tokenResult?.claims?.ipt
      };
      
      console.log("📤 Enviando a /api/test/test-turno:", body);
      
      const resp = await fetch(`${API_URL}/test/test-turno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(body)
      });
      
      const responseText = await resp.text();
      console.log("📡 Respuesta cruda:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Error parseando JSON:", e);
        return;
      }
      
      console.log("📊 Respuesta del test:", data);
      
      if (data.success) {
        console.log("✅ Test exitoso - El flujo está funcionando");
      } else {
        console.log("❌ Test fallido:", data.message);
      }
      
    } catch (error) {
      console.error("❌ Error en test de flujo:", error);
    }
  };
  
  const testComunicacionBasica = async () => {
    try {
      console.log("🧪 Testeando comunicación básica sin autenticación...");
      console.log("📡 API_URL:", API_URL);
      
      const body = {
        fechaSolicitada: "2024-11-26",
        tipoTurno: "insumo", 
        ipt: "123456",
        motivo: "Test de comunicación"
      };
      
      console.log("📤 Enviando a /api/test/public/test-turno:", body);
      console.log("📡 URL completa:", `${API_URL}/test/public/test-turno`);
      
      const startTime = Date.now();
      const resp = await fetch(`${API_URL}/test/public/test-turno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      });
      const endTime = Date.now();
      
      console.log("⏱️ Tiempo de respuesta:", endTime - startTime, "ms");
      console.log("📊 Estado HTTP:", resp.status, resp.statusText);
      console.log("📡 Headers de respuesta:", resp.headers);
      
      const responseText = await resp.text();
      console.log("📄 Respuesta cruda (sin auth):", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Error parseando JSON:", e);
        console.error("📄 Texto que falló al parsear:", responseText);
        Alert.alert("Error", `No se pudo parsear la respuesta: ${responseText.substring(0, 100)}...`);
        return;
      }
      
      console.log("📊 Respuesta del test (sin auth):", data);
      
      if (data.success) {
        console.log("✅ Comunicación básica exitosa");
        Alert.alert("Éxito", `Comunicación exitosa: ${data.message}`);
      } else {
        console.log("❌ Falló comunicación básica:", data.message);
        Alert.alert("Error", `Falló: ${data.message}`);
      }
      
    } catch (error) {
      console.error("❌ Error en test de comunicación:", error);
      console.error("📍 Stack:", error.stack);
      Alert.alert("Error de Red", `Error: ${error.message}`);
    }
  };
  
  const testFlujoCompleto = async () => {
    try {
      console.log("🧪 Testeando flujo completo CON autenticación...");
      
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const token = await auth.currentUser?.getIdToken();
      const ipt = tokenResult?.claims?.ipt;
      
      console.log("👤 Usuario autenticado:", auth.currentUser?.uid);
      console.log("📋 IPT del usuario:", ipt);
      console.log("🔑 Token presente:", !!token);
      
      const body = {
        fechaSolicitada: "2024-11-26",
        tipoTurno: "insumo",
        ipt: ipt || "123456",
        motivo: "Test de flujo completo"
      };
      
      console.log("📤 Enviando a /api/test/test-turno:", body);
      
      const startTime = Date.now();
      const resp = await fetch(`${API_URL}/test/test-turno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const endTime = Date.now();
      
      console.log("⏱️ Tiempo de respuesta:", endTime - startTime, "ms");
      console.log("📊 Estado HTTP:", resp.status, resp.statusText);
      
      const responseText = await resp.text();
      console.log("📄 Respuesta cruda (con auth):", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Error parseando JSON:", e);
        Alert.alert("Error", `No se pudo parsear la respuesta: ${responseText.substring(0, 100)}...`);
        return;
      }
      
      console.log("📊 Respuesta del test (con auth):", data);
      
      if (data.success) {
        console.log("✅ Flujo completo exitoso");
        Alert.alert("Éxito", `Flujo completo exitoso: ${data.message}`);
      } else {
        console.log("❌ Falló flujo completo:", data.message);
        Alert.alert("Error", `Falló: ${data.message}`);
      }
      
    } catch (error) {
      console.error("❌ Error en test de flujo:", error);
      Alert.alert("Error", `Error: ${error.message}`);
    }
  };
  
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [fechaInput, tipo, motivo]);

  const toIso = (s) => {
    console.log("🔄 Convirtiendo fecha:", s);
    const m = String(s).trim().match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
    console.log("📅 Match regex:", m);
    if (!m) return null;
    const dd = m[1], mm = m[2], yyyy = m[3];
    
    // ⚠️ CRÍTICO: Crear fecha en UTC para evitar problemas de zona horaria
    const result = `${yyyy}-${mm}-${dd}`;
    console.log("📍 Fecha formateada (sin zona horaria):", result);
    
    // Crear objeto Date en UTC explícitamente
    const fechaUTC = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)));
    console.log("🌍 Fecha UTC completa:", fechaUTC.toISOString());
    console.log("🌎 Fecha local:", fechaUTC.toLocaleDateString('es-AR'));
    
    return result;
  };

  const checkDisponibilidad = async () => {
    setError("");
    setSuccess("");
    setDisp(null);
    if (!fechaInput || !tipo) { setError("Completá fecha (DD-MM-YYYY) y tipo"); return; }
    const fechaIso = toIso(fechaInput);
    if (!fechaIso) { setError("Fecha inválida. Formato DD-MM-YYYY"); return; }
    const now = new Date();
    const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
    if (fechaIso < todayIso) { setError("Fecha ya pasada"); setDisp(false); return; }
    
    // Validar fin de semana
    const fecha = new Date(fechaIso);
    const diaSemana = fecha.getDay();
    if (diaSemana === 0 || diaSemana === 6) { setError("No se permiten turnos sábado o domingo"); return; }
    
    try {
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const tipoParam = tipo.toLowerCase().includes('insumo') ? 'insumo' : 
                     tipo.toLowerCase().includes('renovación') || tipo.toLowerCase().includes('renov') ? 'carnet' : 'otra';
      const query = `fechaSolicitada=${encodeURIComponent(fechaIso)}&tipoTurno=${encodeURIComponent(tipoParam)}` + (tipoParam === 'insumo' && ipt ? `&ipt=${encodeURIComponent(ipt)}` : "");
      console.log("🔍 Verificando disponibilidad para:", { fechaIso, tipo: tipoParam, ipt, query });
      const resp = await fetch(`${API_URL}/turnos/disponibilidad?${query}`);
      const responseText = await resp.text();
      console.log("📡 Respuesta cruda del backend:", responseText);
      let j;
      try {
        j = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Error parseando JSON:", e);
        setError("Error en respuesta del servidor");
        return;
      }
      console.log("📡 Respuesta parseada del backend:", j);
      const ok = Boolean(j?.disponible);
      console.log("✅ Disponible:", ok);
      setDisp(ok);
      if (!ok) setError(j?.motivo || j?.reason || "No disponible");
    } catch (e) { 
      console.error("❌ Error verificando disponibilidad:", e);
      setError("No se pudo verificar disponibilidad"); 
    }
  };

  const solicitarTurno = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      console.log("🚀 Iniciando solicitud de turno...");
      console.log("📅 Fecha input:", fechaInput);
      console.log("🏷️ Tipo ORIGINAL:", JSON.stringify(tipo));
      console.log("💬 Motivo:", motivo);
      
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const idToken = await auth.currentUser?.getIdToken();
      
      console.log("🔑 Token obtenido:", idToken ? "Sí" : "No");
      console.log("📋 IPT obtenido:", ipt);
      
      if (!idToken) { setError("No estás autenticado"); return; }
      
      const fechaIso = toIso(fechaInput);
      console.log("📅 Fecha ISO convertida:", fechaIso);
      if (!fechaIso) { setError("Fecha inválida. Formato DD-MM-YYYY"); return; }
      const now = new Date();
      const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
      if (fechaIso < todayIso) { setError("Fecha ya pasada"); return; }
      
      // Validar fin de semana
      const fecha = new Date(fechaIso);
      const diaSemana = fecha.getDay();
      console.log("📆 Día de la semana:", diaSemana, "(0=domingo, 6=sábado)");
      if (diaSemana === 0 || diaSemana === 6) { setError("No se permiten turnos sábado o domingo"); return; }
      
      // 🔍 DEBUG: Análisis detallado del tipo
      console.log("🔍 DEBUG - Análisis de tipo:");
      console.log("  - Valor original:", JSON.stringify(tipo));
      console.log("  - toLowerCase():", tipo.toLowerCase());
      console.log("  - includes('insumo'):", tipo.toLowerCase().includes('insumo'));
      console.log("  - includes('renovación'):", tipo.toLowerCase().includes('renovación'));
      console.log("  - includes('renov'):", tipo.toLowerCase().includes('renov'));
      
      let tipoNormalizado;
      if (tipo.toLowerCase().includes('insumo')) {
        tipoNormalizado = 'insumo';
        console.log("✅ Detectado como: insumo");
      } else if (tipo.toLowerCase().includes('renovación') || tipo.toLowerCase().includes('renov')) {
        tipoNormalizado = 'carnet';
        console.log("✅ Detectado como: carnet");
      } else {
        tipoNormalizado = 'otra';
        console.log("⚠️ No detectado, usando: otra");
      }
      
      const body = { 
        ipt, 
        fechaSolicitada: fechaIso, 
        tipoTurno: tipoNormalizado,
        motivo: motivo || ""  // ✅ Agregamos motivo (puede estar vacío)
      };
      
      console.log("📝 Body preparado:", body);
      console.log("🔑 Token de autenticación:", idToken.substring(0, 20) + "...");
      console.log("🌐 URL del endpoint:", `${API_URL}/turnos`);
      
      console.log("📤 Enviando request...");
      const resp = await fetch(`${API_URL}/turnos`, { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }, 
        body: JSON.stringify(body) 
      });
      
      console.log("📡 Respuesta recibida - Status:", resp.status);
      console.log("📡 Respuesta recibida - StatusText:", resp.statusText);
      console.log("📡 Respuesta recibida - Headers:", resp.headers);
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.log("❌ Error en respuesta:", resp.status, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(errorData?.message || `Error ${resp.status}: ${resp.statusText}`);
      }
      
      const responseData = await resp.json();
      console.log("✅ Turno creado exitosamente:", responseData);
      setSuccess(responseData.message || "Turno solicitado exitosamente");
      setFechaInput("");
      setTipo("");
      setDisp(null);
      setMotivo("");
      await loadList();
      setView('list');
    } catch (e) { 
      console.error("❌ Error solicitando turno:", e);
      setError(e.message || "Error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const editarTurno = (turno) => {
    console.log("✏️ Editando turno:", turno);
    setTurnoEditando(turno);
    setFechaInput(formatDDMMYYYY(turno.fechaTurno));
    setTipo(getTipoLabel(turno.tipoTurno));
    setMotivo(turno.motivo || "");
    setView("edit");
    setError("");
    setSuccess("");
  };

  const guardarEdicion = async () => {
    if (!turnoEditando) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) { setError("No estás autenticado"); return; }
      const fechaIso = toIso(fechaInput);
      if (!fechaIso) { setError("Fecha inválida. Formato DD-MM-YYYY"); return; }
      const now = new Date();
      const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
      if (fechaIso < todayIso) { setError("Fecha ya pasada"); return; }
      const fecha = new Date(fechaIso);
      const diaSemana = fecha.getDay();
      if (diaSemana === 0 || diaSemana === 6) { setError("No se permiten turnos sábado o domingo"); return; }
      const tipoNormalizado = tipo.toLowerCase().includes('insumo') ? 'insumo' :
        (tipo.toLowerCase().includes('renovación') || tipo.toLowerCase().includes('renov')) ? 'carnet' : 'otra';
      const body = { fechaTurno: fechaIso, tipoTurno: tipoNormalizado, motivo: motivo || "" };
      console.log("📤 Actualizando turno:", body);
      const resp = await fetch(`${API_URL}/turnos/${turnoEditando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData?.message || "Error al actualizar turno");
      }
      const data = await resp.json();
      console.log("✅ Turno actualizado:", data);
      setSuccess("Turno actualizado exitosamente");
      setTurnoEditando(null);
      setFechaInput("");
      setTipo("");
      setMotivo("");
      await loadList();
      setView("list");
    } catch (error) {
      console.error("❌ Error actualizando turno:", error);
      setError(error.message || "Error al actualizar turno");
    } finally {
      setLoading(false);
    }
  };

  const confirmarEliminarTurno = (turno) => {
    Alert.alert(
      "Eliminar turno",
      `¿Estás seguro de eliminar el turno del ${formatDDMMYYYY(turno.fechaTurno)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => eliminarTurno(turno) }
      ]
    );
  };

  const eliminarTurno = async (turno) => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No estás autenticado");
      console.log("🗑️ Eliminando turno:", turno.id);
      const resp = await fetch(`${API_URL}/turnos/${turno.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData?.message || "Error al eliminar turno");
      }
      console.log("✅ Turno eliminado exitosamente");
      setSuccess("Turno eliminado exitosamente");
      await loadList();
    } catch (error) {
      console.error("❌ Error eliminando turno:", error);
      setError(error.message || "Error al eliminar turno");
    } finally {
      setLoading(false);
    }
  };

  const cancelarEdicion = () => {
    setTurnoEditando(null);
    setFechaInput("");
    setTipo("");
    setMotivo("");
    setError("");
    setSuccess("");
    setView("list");
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Turnos</Text>
      <View style={styles.topBar}>
        <View style={styles.cardBar}>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => setView('form')}>
            <Text style={styles.btnText}>Solicitar Turno</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => setView('list')}>
            <Text style={styles.btnText}>Ver Mis Turnos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'form' && (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TextInput style={styles.input} placeholder="Fecha (DD-MM-YYYY)" value={fechaInput} onChangeText={setFechaInput} />
          <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarTipos(!mostrarTipos)}>
            <Text style={{ color: tipo ? '#2c3e50' : '#95a5a6' }}>{tipo || 'Tipo de turno'}</Text>
          </TouchableOpacity>
          {tipo ? (
            <Text style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>
              🔍 Tipo detectado: {(() => {
                const tipoLower = tipo.toLowerCase();
                const esInsumo = tipoLower.includes('insumo');
                const esRenovacion = tipoLower.includes('renovación') || tipoLower.includes('renov');
                return esInsumo ? 'insumo' : esRenovacion ? 'carnet' : 'otra';
              })()}
            </Text>
          ) : null}
          {mostrarTipos && (
            <View style={styles.dropdown}>
              {tipoOptions.map(opt => (
                <TouchableOpacity key={opt} style={styles.option} onPress={() => { setTipo(opt); setMostrarTipos(false); }}>
                  <Text>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline numberOfLines={3} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <View style={[styles.row, { marginBottom: Math.max(insets.bottom, 24) }]}>
            <TouchableOpacity style={styles.btn} onPress={checkDisponibilidad}><Text style={styles.btnText}>Ver disponibilidad</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={solicitarTurno} disabled={loading || disp !== true}><Text style={styles.btnText}>{loading ? "Solicitando..." : "Solicitar"}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={testFlujoTurno}>
            <Text style={styles.btnText}>🧪 Test Flujo Turno</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#e67e22' }]} onPress={testComunicacionBasica}>
            <Text style={styles.btnText}>📡 Test Comunicación</Text>
          </TouchableOpacity>
          {disp !== null && <Text style={{ marginTop: 8 }}>Disponibilidad: {disp ? "Sí" : "No"}</Text>}
        </View>
      )}

      {view === 'edit' && (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.title}>Editar Turno</Text>
          <TextInput style={styles.input} placeholder="Fecha (DD-MM-YYYY)" value={fechaInput} onChangeText={setFechaInput} />
          <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarTipos(!mostrarTipos)}>
            <Text style={{ color: tipo ? '#2c3e50' : '#95a5a6' }}>{tipo || 'Tipo de turno'}</Text>
          </TouchableOpacity>
          {tipo ? (
            <Text style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>
              🔍 Tipo detectado: {(() => {
                const tipoLower = tipo.toLowerCase();
                const esInsumo = tipoLower.includes('insumo');
                const esRenovacion = tipoLower.includes('renovación') || tipoLower.includes('renov');
                return esInsumo ? 'insumo' : esRenovacion ? 'carnet' : 'otra';
              })()}
            </Text>
          ) : null}
          {mostrarTipos && (
            <View style={styles.dropdown}>
              {tipoOptions.map(opt => (
                <TouchableOpacity key={opt} style={styles.option} onPress={() => { setTipo(opt); setMostrarTipos(false); }}>
                  <Text>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline numberOfLines={3} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <View style={[styles.row, { marginBottom: Math.max(insets.bottom, 24) }]}>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={cancelarEdicion}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={guardarEdicion} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Guardando..." : "Guardar cambios"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {view === 'list' && (
        <View style={{ padding: 8 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Mis turnos</Text>
          <FlatList 
            data={list} 
            keyExtractor={(item) => item.id} 
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.turnoCard}>
                <View style={styles.turnoHeader}>
                  <Text style={styles.turnoFecha}>{formatDDMMYYYY(item.fechaTurno)}</Text>
                  <Text style={[styles.turnoEstado, { backgroundColor: getEstadoColor(item.estado) }]}>{item.estado}</Text>
                </View>
                <Text style={styles.turnoTipo}>Tipo: {getTipoLabel(item.tipoTurno)}</Text>
                {item.motivo ? <Text style={styles.turnoMotivo}>Motivo: {item.motivo}</Text> : null}
                
                {/* Botones de acción */}
                <View style={styles.turnoActions}>
                  <TouchableOpacity style={styles.btnEditar} onPress={() => editarTurno(item)}>
                    <Text style={styles.btnActionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnEliminar} onPress={() => confirmarEliminarTurno(item)}>
                    <Text style={styles.btnActionText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )} 
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  cardBar: { flexDirection: "row", gap: 12, backgroundColor: "#ffffff", padding: 10, borderRadius: 10, elevation: 3 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  input: { borderWidth: 1.5, borderColor: "#95a5a6", backgroundColor: "#fdfefe", padding: 12, borderRadius: 10, marginBottom: 12 },
  dropdown: { borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, backgroundColor: '#ffffff', marginBottom: 12 },
  option: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ecf0f1' },
  row: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
  btn: { backgroundColor: "#1e8449", padding: 10, borderRadius: 8 },
  primary: { backgroundColor: "#2ecc71" },
  secondary: { backgroundColor: "#3498db" },
  btnText: { color: "#fff" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
  success: { color: "#27ae60", textAlign: "center", marginBottom: 8 },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemText: { color: "#34495e" },
  // Estilos para tarjetas de turnos
  turnoCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, elevation: 2, marginBottom: 12 },
  turnoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  turnoFecha: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  turnoEstado: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, color: '#fff', overflow: 'hidden', fontSize: 12 },
  turnoTipo: { fontSize: 14, color: '#34495e', marginBottom: 4 },
  turnoMotivo: { fontSize: 13, color: '#7f8c8d', fontStyle: 'italic' },
  // Estilos para botones de acción
  turnoActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  btnEditar: { backgroundColor: '#3498db', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnEliminar: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
  const getEstadoColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente': return '#f39c12';
      case 'confirmado': return '#27ae60';
      case 'cancelado': return '#e74c3c';
      case 'completado': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getTipoLabel = (tipo) => {
    switch (tipo?.toLowerCase()) {
      case 'insumo': return 'Insumo';
      case 'carnet': return 'Renovación de Carnet';
      case 'otra': return 'Otra';
      default: return tipo || 'Otra';
    }
  };


  const formatDDMMYYYY = (isoOrDdmm) => {
    if (!isoOrDdmm) return "-";
    
    console.log("📅 formatDDMMYYYY - Input:", JSON.stringify(isoOrDdmm));
    
    // Si ya está en formato dd-mm-yyyy, devolverlo directamente
    const mdd = String(isoOrDdmm).match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
    if (mdd) {
      console.log("📅 Ya está en formato dd-mm-yyyy:", `${mdd[1]}-${mdd[2]}-${mdd[3]}`);
      return `${mdd[1]}-${mdd[2]}-${mdd[3]}`;
    }
    
    // Para fechas ISO, usar UTC para evitar problemas de zona horaria
    const d = new Date(isoOrDdmm);
    if (isNaN(d.getTime())) {
      console.log("📅 Fecha inválida, devolviendo original:", String(isoOrDdmm));
      return String(isoOrDdmm);
    }
    
    // Usar métodos UTC para evitar problemas de zona horaria
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    
    const resultado = `${dd}-${mm}-${yyyy}`;
    console.log("📅 Convertido a dd-mm-yyyy (UTC):", resultado);
    return resultado;
  };
