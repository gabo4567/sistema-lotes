// mobile-app/src/screens/TurnosScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView, Modal, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";
import { offlineTurnosOperations } from "../utils/offlineOperations";
import { useOffline } from "../hooks/useOffline";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TurnosScreen() {
  const [fechaInput, setFechaInput] = useState("");
  const [tipo, setTipo] = useState("");
  const [mostrarTipos, setMostrarTipos] = useState(false);
  const tipoOptions = ["Insumo", "Renovación de Carnet", "Otro"];
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosPickerDate, setIosPickerDate] = useState(new Date());
  const [disp, setDisp] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [motivo, setMotivo] = useState("");
  const [view, setView] = useState("list");
  const [listMode, setListMode] = useState("activos"); // "activos" o "inactivos"
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [orden, setOrden] = useState("proximos"); // "proximos" | "lejanos"
  const [turnoEditando, setTurnoEditando] = useState(null);
  const insets = useSafeAreaInsets();
  const { isOnline, pendingOperations, isProcessing, subscribeOperations } = useOffline();
  const [showingOfflineData, setShowingOfflineData] = useState(false);
  const prevPendingOpsRef = React.useRef(pendingOperations);

  const loadList = async () => {
    try {
      setLoading(true);
      const currentUid = auth.currentUser?.uid ? String(auth.currentUser.uid) : "";
      const cacheKey = `cache_turnos_${currentUid || "unknown"}_${listMode}`;
      if (!isOnline) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          const parsed = raw ? JSON.parse(raw) : [];
          const cached = Array.isArray(parsed) ? parsed : [];

          let queuedCreates = [];
          if (listMode === "activos") {
            try {
              const opsRaw = await AsyncStorage.getItem("offline_operations");
              const ops = opsRaw ? JSON.parse(opsRaw) : [];
              const createOps = Array.isArray(ops) ? ops.filter((op) => op?.type === "CREATE_TURNO") : [];
              queuedCreates = createOps.map((op) => {
                const fechaIso = op?.data?.fechaSolicitada;
                const fechaTurno = fechaIso ? `${fechaIso}T12:00:00.000Z` : undefined;
                return {
                  id: `temp_${op.id}`,
                  activo: true,
                  creadoEn: op.timestamp || new Date().toISOString(),
                  estado: "pendiente",
                  fecha: fechaTurno,
                  fechaTurno,
                  productorId: currentUid || auth.currentUser?.uid,
                  tipoTurno: op?.data?.tipoTurno,
                  motivo: op?.data?.motivo || "",
                  _isOffline: true,
                  _operationId: op.id,
                };
              });
            } catch {}
          }

          const byId = new Map();
          for (const item of cached) {
            if (!item?.id) continue;
            byId.set(String(item.id), item);
          }
          for (const item of queuedCreates) {
            if (!item?.id) continue;
            const key = String(item.id);
            if (!byId.has(key)) byId.set(key, item);
          }

          setList(Array.from(byId.values()));
          setError("");
        } catch {
          setList([]);
        }
        setShowingOfflineData(true);
        return;
      }
      setShowingOfflineData(false);
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!currentUid || !idToken) return;
      
      const productorId = tokenResult?.claims?.productorId || currentUid;
      const activo = listMode === "activos";
      
      const resp = await fetch(`${API_URL}/turnos/productor/${productorId}?activo=${activo}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const j = await resp.json();
      const next = Array.isArray(j) ? j : [];
      setList(next);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    } catch (error) {
      console.error("❌ Error cargando turnos:", error);
      setList([]);
    }
    finally {
      setLoading(false);
    }
  };

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

  useEffect(() => { 
    loadList(); 
  }, [listMode, isOnline]);

  useEffect(() => {
    const prev = prevPendingOpsRef.current;
    if (isOnline && prev > 0 && pendingOperations === 0 && !isProcessing) {
      loadList();
    }
    prevPendingOpsRef.current = pendingOperations;
  }, [isOnline, isProcessing, pendingOperations]);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid ? String(auth.currentUser.uid) : "";
    const cacheKey = `cache_turnos_${currentUid || "unknown"}_${listMode}`;
    const unsubscribe = subscribeOperations(async (event) => {
      if (event?.status !== "success") return;
      if (event?.operation?.type !== "CREATE_TURNO") return;
      if (listMode !== "activos") return;

      const tempId = `temp_${event.operation.id}`;
      const real = event.result && typeof event.result === "object" ? { ...event.result, _isOffline: false } : null;
      if (!real?.id) return;

      setList((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        let foundTemp = false;
        const replaced = prevArr.map((item) => {
          if (String(item?.id) === String(tempId)) {
            foundTemp = true;
            return real;
          }
          return item;
        });
        const merged = foundTemp ? replaced : [real, ...replaced];
        const seen = new Set();
        return merged.filter((item) => {
          const key = String(item?.id);
          if (!key) return false;
          if (key === String(tempId)) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const cached = Array.isArray(parsed) ? parsed : [];
        let foundTemp = false;
        const replaced = cached.map((item) => {
          if (String(item?.id) === String(tempId)) {
            foundTemp = true;
            return real;
          }
          return item;
        });
        const merged = foundTemp ? replaced : [real, ...replaced];
        const seen = new Set();
        const next = merged.filter((item) => {
          const key = String(item?.id);
          if (!key) return false;
          if (key === String(tempId)) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    });

    return unsubscribe;
  }, [listMode, subscribeOperations]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [fechaInput, tipo, motivo]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}> 
        <Text style={styles.title}>Turnos</Text>
        <Text style={{ textAlign: 'center', color: '#1e8449', marginTop: 8 }}>Cargando turnos...</Text>
        <ActivityIndicator color="#1e8449" style={{ marginTop: 8 }} />
      </SafeAreaView>
    );
  }
  
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

  const minSelectableDate = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const parseInputToDate = (raw) => {
    const s = String(raw || "").trim();
    const m = s.match(/^([0-3][0-9])[-/]([0-1][0-9])[-/](\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDDMMYYYYSlash = (d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const isWeekend = (d) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  const getUTCDayFromIsoDate = (isoDate) => {
    const s = String(isoDate || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    return d.getUTCDay();
  };

  const getTurnoDateMs = (turno) => {
    const raw = turno?.fechaTurno ?? turno?.fecha;
    if (!raw) return null;
    if (raw instanceof Date) {
      const ms = raw.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (raw && typeof raw === "object" && typeof raw._seconds === "number") {
      return raw._seconds * 1000;
    }
    if (typeof raw === "string") {
      const s = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const day = getUTCDayFromIsoDate(s);
        if (day === null) return null;
        const [yyyy, mm, dd] = s.split("-").map(Number);
        const ms = Date.UTC(yyyy, mm - 1, dd, 12, 0, 0, 0);
        return Number.isFinite(ms) ? ms : null;
      }
      const ms = Date.parse(s);
      return Number.isFinite(ms) ? ms : null;
    }
    return null;
  };

  const openDatePicker = () => {
    const minDate = minSelectableDate();
    const current = parseInputToDate(fechaInput);
    const base = current && current >= minDate ? current : minDate;
    if (Platform.OS === "ios") setIosPickerDate(base);
    setShowDatePicker(true);
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
    const diaSemana = getUTCDayFromIsoDate(fechaIso);
    if (diaSemana === null) { setError("Fecha inválida"); return; }
    if (diaSemana === 0 || diaSemana === 6) { setError("No se permiten turnos sábado o domingo"); return; }

    if (!isOnline) {
      setDisp(true);
      setSuccess("Sin conexión: no se puede verificar disponibilidad. Podés solicitar el turno y se enviará automáticamente cuando vuelva internet (puede ser rechazado si no hay cupo/disponibilidad).");
      return;
    }
    
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
      const diaSemana = getUTCDayFromIsoDate(fechaIso);
      if (diaSemana === null) { setError("Fecha inválida"); return; }
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
        tipoNormalizado = 'otro';
        console.log("⚠️ No detectado, usando: otro");
      }

      const motivoTrim = String(motivo || '').trim();
      if (tipoNormalizado === 'otro' && !motivoTrim) {
        setError('Si el tipo es "Otro", el motivo es obligatorio.');
        return;
      }

      const productorId = tokenResult?.claims?.productorId || auth.currentUser?.uid;
      const requestedKey = `${fechaIso} 12:00`;
      const isEstadoBloqueante = (estadoRaw) => {
        const st = String(estadoRaw || '').toLowerCase();
        return st !== 'cancelado' && st !== 'completado' && st !== 'vencido';
      };
      const toKeyFromAnyDate = (rawDate) => {
        if (!rawDate) return null;
        let d = null;
        if (rawDate instanceof Date) {
          d = rawDate;
        } else if (rawDate && typeof rawDate === 'object' && rawDate._seconds) {
          d = new Date(rawDate._seconds * 1000);
        } else if (typeof rawDate === 'string') {
          const s = rawDate.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            d = new Date(`${s}T12:00:00.000Z`);
          } else {
            d = new Date(s);
          }
        }
        if (!(d instanceof Date) || isNaN(d.getTime())) return null;
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${hh}:${mm}`;
      };

      let turnosParaValidar = Array.isArray(list) ? list : [];
      if (isOnline && productorId && idToken) {
        try {
          const respTurnos = await fetch(`${API_URL}/turnos/productor/${productorId}?activo=true`, {
            headers: { "Authorization": `Bearer ${idToken}` }
          });
          const jTurnos = await respTurnos.json();
          if (Array.isArray(jTurnos)) {
            turnosParaValidar = [...turnosParaValidar, ...jTurnos];
          }
        } catch (e) {
          console.error("❌ Error cargando turnos para validación:", e);
        }
      }

      const hayDuplicado = turnosParaValidar.some(t => {
        if (!t) return false;
        if (t.activo === false) return false;
        if (!isEstadoBloqueante(t.estado)) return false;
        const tipoExistente = String(t.tipoTurno || '').toLowerCase() === 'otra' ? 'otro' : String(t.tipoTurno || '').toLowerCase();
        if (tipoExistente !== tipoNormalizado) return false;
        const key = toKeyFromAnyDate(t.fechaTurno || t.fecha);
        return key === requestedKey;
      });

      if (hayDuplicado) {
        setError("Ya tenés un turno del mismo tipo para esa fecha y hora. Elegí otra fecha/hora o solicitá un tipo diferente.");
        return;
      }
      
      const body = { 
        ipt, 
        fechaSolicitada: fechaIso, 
        tipoTurno: tipoNormalizado,
        motivo: motivoTrim
      };
      
      console.log("📝 Body preparado:", body);

      const result = await offlineTurnosOperations.createTurno(body);
      const wasOffline = Boolean(result?._isOffline);

      if (wasOffline) {
        const nuevo = {
          id: result.id,
          activo: true,
          creadoEn: new Date().toISOString(),
          estado: "pendiente",
          fecha: `${fechaIso}T12:00:00.000Z`,
          fechaTurno: `${fechaIso}T12:00:00.000Z`,
          productorId: auth.currentUser?.uid,
          tipoTurno: tipoNormalizado,
          motivo: body.motivo || "",
          _isOffline: true,
        };
        setList((prev) => [nuevo, ...(Array.isArray(prev) ? prev : [])]);
        const msg = "Turno guardado offline. Se sincronizará cuando recuperes la conexión a internet.";
        setSuccess(msg);
        Alert.alert("Guardado offline", msg, [{ text: "Aceptar" }]);
      } else {
        const msg = result?.message || "Turno solicitado exitosamente";
        setSuccess(msg);
        Alert.alert("¡Éxito!", msg, [{ text: "Aceptar" }]);
      }

      setFechaInput("");
      setTipo("");
      setDisp(null);
      setMotivo("");
      if (isOnline && !wasOffline) {
        await loadList();
      }
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
    const st = String(turno.estado || '').toLowerCase();
    if (st !== 'pendiente') {
      Alert.alert('No permitido', `No puedes editar un turno ${st}.`);
      return;
    }
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
      const diaSemana = getUTCDayFromIsoDate(fechaIso);
      if (diaSemana === null) { setError("Fecha inválida"); return; }
      if (diaSemana === 0 || diaSemana === 6) { setError("No se permiten turnos sábado o domingo"); return; }
      const tipoNormalizado = tipo.toLowerCase().includes('insumo') ? 'insumo' :
        (tipo.toLowerCase().includes('renovación') || tipo.toLowerCase().includes('renov')) ? 'carnet' : 'otro';
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
      const msg = data?.message || "Turno actualizado exitosamente";
      setSuccess(msg);
      Alert.alert("¡Éxito!", msg, [{ text: "Aceptar" }]);
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
    const st = String(turno.estado || '').toLowerCase();
    if (st !== 'pendiente') {
      Alert.alert('No permitido', `No puedes cancelar un turno ${st}.`);
      return;
    }
    Alert.alert(
      "Cancelar turno",
      `¿Estás seguro de cancelar el turno del ${formatDDMMYYYY(turno.fechaTurno)}?`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, cancelar", style: "destructive", onPress: () => cancelarTurno(turno) }
      ]
    );
  };

  const cancelarTurno = async (turno) => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No estás autenticado");
      console.log("🚫 Cancelando turno:", turno.id);
      
      const body = { estado: 'cancelado', motivo: 'Cancelado por el productor' };
      
      const resp = await fetch(`${API_URL}/turnos/${turno.id}/estado`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}` 
        },
        body: JSON.stringify(body)
      });
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData?.message || "Error al cancelar turno");
      }
      
      console.log("✅ Turno cancelado exitosamente");
      setSuccess("Turno cancelado exitosamente");
      await loadList();
    } catch (error) {
      console.error("❌ Error cancelando turno:", error);
      setError(error.message || "Error al cancelar turno");
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

  const isSolicitarTabActive = view === "form";
  const isVerMisTurnosTabActive = view !== "form";

  const renderFechaPicker = () => (
    <>
      <TouchableOpacity style={[styles.input, { justifyContent: "center" }]} onPress={openDatePicker}>
        <Text style={{ color: fechaInput ? "#2c3e50" : "#95a5a6" }}>{fechaInput || "Fecha (DD/MM/AAAA)"}</Text>
      </TouchableOpacity>
      {showDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseInputToDate(fechaInput) || minSelectableDate()}
          mode="date"
          display="calendar"
          minimumDate={minSelectableDate()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event?.type === "set" && selectedDate) {
              if (isWeekend(selectedDate)) {
                Alert.alert("Fecha no permitida", "No se permiten turnos en fin de semana (sábado o domingo).");
                return;
              }
              setFechaInput(formatDDMMYYYYSlash(selectedDate));
            }
          }}
        />
      ) : null}
      <Modal
        transparent
        animationType="fade"
        visible={showDatePicker && Platform.OS === "ios"}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModalCard}>
            <DateTimePicker
              value={iosPickerDate}
              mode="date"
              display="inline"
              minimumDate={minSelectableDate()}
              onChange={(_, selectedDate) => {
                if (selectedDate) setIosPickerDate(selectedDate);
              }}
            />
            <View style={styles.dateModalActions}>
              <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.primary]}
                onPress={() => {
                  if (isWeekend(iosPickerDate)) {
                    Alert.alert("Fecha no permitida", "No se permiten turnos en fin de semana (sábado o domingo).");
                    return;
                  }
                  setFechaInput(formatDDMMYYYYSlash(iosPickerDate));
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.btnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Turnos</Text>
      {showingOfflineData && (
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff7ed", borderColor: "#fed7aa", borderWidth: 1, borderRadius: 10 }}>
          <Text style={{ color: "#9a3412" }}>Mostrando datos sin conexión</Text>
        </View>
      )}
      <View style={styles.topBar}>
        <View style={styles.cardBar}>
          <TouchableOpacity
            style={[styles.btn, styles.primary, isSolicitarTabActive ? styles.topTabActive : styles.topTabInactive]}
            onPress={() => setView("form")}
          >
            <Text style={[styles.btnText, styles.topTabText, isSolicitarTabActive && styles.topTabTextActive]}>Solicitar Turno</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.secondary, isVerMisTurnosTabActive ? styles.topTabActive : styles.topTabInactive]}
            onPress={() => setView("list")}
          >
            <Text style={[styles.btnText, styles.topTabText, isVerMisTurnosTabActive && styles.topTabTextActive]}>Ver Mis Turnos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'list' && (
        <View style={{ flex: 1 }}>
          {/* Filtros Activos/Inactivos */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <View style={styles.listTabs}>
              <TouchableOpacity 
                style={[styles.listTab, listMode === "activos" && styles.listTabActive]}
                onPress={() => setListMode("activos")}
              >
                <Text style={[styles.listTabText, listMode === "activos" && styles.listTabTextActive]}>Activos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.listTab, listMode === "inactivos" && styles.listTabActive]}
                onPress={() => setListMode("inactivos")}
              >
                <Text style={[styles.listTabText, listMode === "inactivos" && styles.listTabTextActive]}>Inactivos</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1, padding: 8 }}>
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Filtrar por estado:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {["todos", "pendiente", "confirmado", "cancelado", "completado", "vencido"].map(est => (
                  <TouchableOpacity 
                    key={est}
                    style={[styles.filterBadge, filtroEstado === est && styles.filterBadgeActive]}
                    onPress={() => setFiltroEstado(est)}
                  >
                    <Text style={[styles.filterBadgeText, filtroEstado === est && styles.filterBadgeTextActive]}>
                      {est.charAt(0).toUpperCase() + est.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Ordenar por:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterBadge, orden === "proximos" && styles.filterBadgeActive]}
                  onPress={() => setOrden("proximos")}
                >
                  <Text style={[styles.filterBadgeText, orden === "proximos" && styles.filterBadgeTextActive]}>
                    Más próximos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterBadge, orden === "lejanos" && styles.filterBadgeActive]}
                  onPress={() => setOrden("lejanos")}
                >
                  <Text style={[styles.filterBadgeText, orden === "lejanos" && styles.filterBadgeTextActive]}>
                    Más lejanos
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <FlatList 
              data={[...list.filter(t => filtroEstado === "todos" || t.estado?.toLowerCase() === filtroEstado)].sort((a, b) => {
                const aMs = getTurnoDateMs(a);
                const bMs = getTurnoDateMs(b);
                if (aMs === null && bMs === null) return 0;
                if (aMs === null) return 1;
                if (bMs === null) return -1;
                return orden === "lejanos" ? bMs - aMs : aMs - bMs;
              })} 
              keyExtractor={(item) => item.id} 
              ListEmptyComponent={<Text style={styles.emptyText}>No hay turnos para mostrar.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.turnoCard, item.activo === false && { opacity: 0.7 }]}>
                  <View style={styles.turnoHeader}>
                    <Text style={styles.turnoFecha}>{formatDDMMYYYY(item.fechaTurno)}</Text>
                    <View style={styles.turnoHeaderRight}>
                      <Text style={[styles.turnoEstado, { backgroundColor: getEstadoColor(item.estado) }]}>{item.estado}</Text>
                      {item._isOffline ? (
                        <Text style={styles.turnoSyncBadge}>Pendiente de sincronización</Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.turnoTipo}>Tipo: {getTipoLabel(item.tipoTurno)}</Text>
                  <Text style={styles.turnoMotivo}>Motivo: {item.motivo || 'No especificado'}</Text>
                  
                  {item.activo !== false && (
                    <View style={styles.turnoActions}>
                      <TouchableOpacity style={styles.btnEditar} onPress={() => editarTurno(item)}>
                        <Text style={styles.btnActionText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnEliminar} onPress={() => confirmarEliminarTurno(item)}>
                        <Text style={styles.btnActionText}>Cancelar Turno</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              )} 
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      )}

      {view === 'form' && (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {renderFechaPicker()}
          <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarTipos(!mostrarTipos)}>
            <Text style={{ color: tipo ? '#2c3e50' : '#95a5a6' }}>{tipo || 'Tipo de turno'}</Text>
          </TouchableOpacity>
          {tipo ? (
            <Text style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>
              🔍 Tipo detectado: {(() => {
                const tipoLower = tipo.toLowerCase();
                const esInsumo = tipoLower.includes('insumo');
                const esRenovacion = tipoLower.includes('renovación') || tipoLower.includes('renov');
                return esInsumo ? 'insumo' : esRenovacion ? 'carnet' : 'otro';
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
            <TouchableOpacity style={styles.btn} onPress={solicitarTurno} disabled={loading || (isOnline && disp !== true)}><Text style={styles.btnText}>{loading ? "Solicitando..." : "Solicitar"}</Text></TouchableOpacity>
          </View>
          {disp !== null && <Text style={{ marginTop: 8 }}>Disponibilidad: {disp ? "Sí" : "No"}</Text>}
        </View>
      )}

      {view === 'edit' && (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.title}>Editar Turno</Text>
          {renderFechaPicker()}
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
    </SafeAreaView>
  );
}

// (loading handled inside component)

// Mostrar pantalla de carga cuando `loading` está activo
if (false) {}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, textAlign: "center", marginVertical: 10, color: "#1e8449" },
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
  topTabText: { fontSize: 15, fontWeight: "700" },
  topTabInactive: { opacity: 1, borderWidth: 2.5, borderColor: "transparent" },
  topTabActive: { opacity: 1, borderWidth: 2.5, borderColor: "#fff", elevation: 6, shadowColor: "#000", shadowOpacity: 0.22, shadowOffset: { width: 0, height: 3 }, shadowRadius: 5 },
  topTabTextActive: { fontWeight: "800" },
  dateModalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  dateModalCard: { backgroundColor: "#ffffff", padding: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  dateModalActions: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 10 },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 8 },
  success: { color: "#27ae60", textAlign: "center", marginBottom: 8 },
  item: { padding: 8, backgroundColor: "#ffffff", borderRadius: 8, marginBottom: 6 },
  itemText: { color: "#34495e" },
  // Estilos para tarjetas de turnos
  turnoCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(15,23,42,0.10)', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  turnoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  turnoHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  turnoFecha: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  turnoEstado: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, color: '#fff', overflow: 'hidden', fontSize: 12 },
  turnoSyncBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#fef3c7', color: '#92400e', overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  turnoTipo: { fontSize: 14, color: '#34495e', marginBottom: 4 },
  turnoMotivo: { fontSize: 13, color: '#7f8c8d', fontStyle: 'italic' },
  // Estilos para botones de acción
  turnoActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  btnEditar: { backgroundColor: '#3498db', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnEliminar: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // Estilos nuevos para filtros y tabs
  listTabs: { flexDirection: 'row', backgroundColor: '#f1f2f6', borderRadius: 8, padding: 4, marginBottom: 12 },
  listTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  listTabActive: { backgroundColor: '#ffffff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  listTabText: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  listTabTextActive: { color: '#2c3e50', fontWeight: '700' },
  filterContainer: { marginBottom: 12 },
  filterLabel: { fontSize: 12, color: '#7f8c8d', marginBottom: 6, fontWeight: '600' },
  filterScroll: { flexDirection: 'row' },
  filterBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f2f6', marginRight: 8, borderWeight: 1, borderColor: 'transparent' },
  filterBadgeActive: { backgroundColor: '#e8f5e9', borderColor: '#2ecc71' },
  filterBadgeText: { fontSize: 12, color: '#7f8c8d' },
  filterBadgeTextActive: { color: '#1e8449', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#95a5a6', marginTop: 20, fontStyle: 'italic' },
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
      case 'otro': return 'Otro';
      default: return tipo || 'Otro';
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
