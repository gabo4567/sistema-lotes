// ✅ src/controllers/informes.controller.js

import { db } from "../utils/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// 📘 Resumen general del sistema
export const obtenerResumenGeneral = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const [usuariosSnap, productoresSnap, lotesSnap, ordenesSnap, turnosSnap, medicionesSnap, insumosSnap, asignSnap, ingresosSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("productores").where("activo", "==", true).get(),
      db.collection("lotes").where("activo", "==", true).get(),
      db.collection("ordenes").where("activo", "==", true).get(),
      db.collection("turnos").where("activo", "==", true).get(),
      db.collection("mediciones").get(),
      db.collection("insumos").get(),
      db.collection("productorInsumos").get(),
      db.collection("ingresosProductor").get(),
    ]);

    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };

    const totalLotesActivos = lotesSnap.docs.filter(doc => inRange(doc.data().fechaCreacion || doc.data().createdAt)).length;
    const totalTurnosActivos = turnosSnap.docs.filter(doc => inRange(doc.data().fechaTurno || doc.data().fecha || doc.data().creadoEn)).length;
    const totalMedicionesRegistradas = medicionesSnap.docs.filter(doc => inRange(doc.data().fecha || doc.data().createdAt)).length;

    // Usuarios detallados (nombre, email, role, ipt si corresponde)
    const usuariosRaw = usuariosSnap.docs.map(d => {
      const u = d.data();
      return { id: d.id, nombre: u.nombre || u.displayName || "", email: (u.email || "").toLowerCase(), role: u.role || "", ipt: u.ipt || u.productorIpt || null };
    });
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const exInclude = (n, e) => {
      if (n === "bautista" && e === "bauticapovilla9@gmail.com") return true;
      if (n === "juan perez" && e === "juan123@example.com") return true;
      return false;
    };
    let usuariosFiltrados = usuariosRaw.filter(u => {
      const n = norm(u.nombre);
      const e = norm(u.email);
      if (exInclude(n, e)) return true;
      if (n === "juan perez") return false;
      if (n === "bautista") return false;
      if (n === "bautista" && (e === "juan@example.com" || e === "juan.example.com")) return false;
      if (n === "juan perez" && (e === "juan@example.com" || e === "juan.example.com")) return false;
      return true;
    });
    usuariosFiltrados = usuariosFiltrados.map(u => {
      const n = norm(u.nombre), e = norm(u.email);
      if (n === "bautista" && e === "bauticapovilla9@gmail.com") {
        return { ...u, role: "Administrador" };
      }
      return u;
    });
    const roleRank = (r) => {
      const v = norm(r);
      if (v === 'administrador') return 4;
      if (v === 'supervisor') return 3;
      if (v === 'tecnico' || v === 'técnico') return 2;
      if (v === 'productor') return 1;
      return 0;
    };
    const dedupByEmail = () => {
      const map = new Map();
      usuariosFiltrados.forEach(u => {
        const key = norm(u.email);
        if (!key) { map.set(`${u.id}_${Math.random()}`, u); return; }
        const cur = map.get(key);
        if (!cur) { map.set(key, u); return; }
        if (roleRank(u.role) > roleRank(cur.role)) { map.set(key, u); }
      });
      return Array.from(map.values());
    };
    const usuarios = dedupByEmail();

    // Mapa de productores por IPT y por nombre
    const prodByIpt = new Map();
    const historialByIpt = new Map();
    const prodByName = new Map();
    productoresSnap.docs.forEach(p => {
      const pd = p.data();
      const nombreFull = pd.nombreCompleto || pd.nombre || "";
      const nameNorm = String(nombreFull).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const iptStr = String(pd.ipt || '');
      prodByIpt.set(iptStr, { id: p.id, nombre: nombreFull });
      historialByIpt.set(iptStr, Number(pd.historialIngresos || 0));
      if (nameNorm) prodByName.set(nameNorm, { ipt: iptStr, nombre: nombreFull });
    });

    // Lotes con dueño
    const lotesConDueno = lotesSnap.docs
      .filter(doc => inRange(doc.data().fechaCreacion || doc.data().createdAt))
      .map(doc => {
        const d = doc.data();
        const ipt = d.ipt ? String(d.ipt) : null;
        const prod = ipt ? prodByIpt.get(ipt) : null;
        return {
          id: doc.id,
          nombre: d.nombre || d.ipt || doc.id,
          ipt,
          productorNombre: prod ? prod.nombre : undefined,
        };
      });

    // Insumos disponibles por tipo
    const insumosDisponibles = insumosSnap.docs.map(di => {
      const x = di.data();
      return { id: di.id, nombre: x.nombre, cantidadDisponible: Number(x.cantidadDisponible || 0), unidad: x.unidad || "bolsas" };
    });

    // Insumos asignados a productores (detalle)
    const insNombreById = new Map(insumosDisponibles.map(i => [i.id, i.nombre]));
    const prodById = new Map();
    productoresSnap.docs.forEach(p => {
      const d = p.data();
      prodById.set(p.id, { ipt: String(d.ipt || ''), nombre: d.nombreCompleto || d.nombre || '' });
    });
    const insumosAsignadosDetalle = asignSnap.docs
      .map(a => ({ id: a.id, ...a.data() }))
      .filter(a => inRange(a.fechaAsignacion))
      .map(a => ({
        tipo: insNombreById.get(String(a.insumoId)) || String(a.insumoId),
        cantidadAsignada: Number(a.cantidadAsignada || 0),
        productorIpt: (prodById.get(String(a.productorId))?.ipt) || '',
        productorNombre: (prodById.get(String(a.productorId))?.nombre) || '',
      }));

    // Actividad móvil por productor
    const actividadMap = new Map();
    const ensureAct = (ipt, nombre) => {
      const key = String(ipt||'');
      if (!actividadMap.has(key)) actividadMap.set(key, { productorIpt: key, productorNombre: nombre||'', ingresosApp: 0, medicionesRegistradas: 0, lotesCreados: 0, lotesModificados: 0, turnosSolicitados: 0 });
      return actividadMap.get(key);
    };
    productoresSnap.docs.forEach(p=>{
      const d = p.data();
      const ipt = String(d.ipt||'');
      const nombre = d.nombreCompleto || d.nombre || '';
      const act = ensureAct(ipt, nombre);
      const useRange = Boolean(start && end);
      if (useRange) {
        // Conteo de ingresos en rango
        act.ingresosApp = 0;
      } else {
        act.ingresosApp = Number(d.historialIngresos || 0);
      }
    });

    // Construir conteo de ingresos por IPT en rango
    const ingresosCount = new Map();
    ingresosSnap.docs.forEach(di => {
      const ing = di.data();
      if (!inRange(ing.fecha)) return;
      const ipt = String(ing.ipt || '');
      if (!ipt) return;
      ingresosCount.set(ipt, (ingresosCount.get(ipt) || 0) + 1);
    });
    // Aplicar conteo al mapa de actividad cuando corresponda
    if (start && end) {
      for (const [ipt, cnt] of ingresosCount.entries()) {
        const cur = ensureAct(ipt, (prodByIpt.get(ipt)?.nombre || ''));
        cur.ingresosApp = cnt;
      }
      // En modo filtrado, si no hubo ingresos en el rango, debe mostrarse 0
      for (const [ipt, act] of actividadMap.entries()) {
        if (!ingresosCount.has(ipt)) act.ingresosApp = 0;
      }
    }
    lotesSnap.docs.forEach(doc=>{
      const d = doc.data();
      const ipt = d.ipt ? String(d.ipt) : (d.productorId ? (prodById.get(String(d.productorId))?.ipt || '') : '');
      const nombre = ipt ? (prodByIpt.get(ipt)?.nombre || '') : '';
      const createdOk = inRange(d.fechaCreacion || d.createdAt);
      const updatedOk = inRange(d.updatedAt);
      if (ipt && createdOk) ensureAct(ipt, nombre).lotesCreados++;
      if (ipt && updatedOk) ensureAct(ipt, nombre).lotesModificados++;
    });
    medicionesSnap.docs.forEach(m=>{
      const md = m.data();
      if (!inRange(md.fecha || md.createdAt)) return;
      const prodField = String(md.productor || '').trim();
      let ipt = '';
      if (/^\d+$/.test(prodField)) ipt = prodField; else {
        const p = prodByName.get(prodField.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        ipt = p ? p.ipt : '';
      }
      const nombre = ipt ? (prodByIpt.get(ipt)?.nombre || '') : '';
      if (ipt) ensureAct(ipt, nombre).medicionesRegistradas++;
    });
    turnosSnap.docs.forEach(tdoc=>{
      const t = tdoc.data();
      const fechaT = t.fechaTurno || t.fecha || t.creadoEn;
      if (!inRange(fechaT)) return;
      const ipt = t.ipt ? String(t.ipt) : (t.productorId ? (prodById.get(String(t.productorId))?.ipt || '') : '');
      const nombre = ipt ? (prodByIpt.get(ipt)?.nombre || '') : '';
      if (ipt) ensureAct(ipt, nombre).turnosSolicitados++;
    });
    const actividadMovil = Array.from(actividadMap.values()).filter(x=> x.productorIpt);

    // Mediciones resumen por tipo y recientes
    const conteoTipos = {};
    const medicionesLista = medicionesSnap.docs.map(m => ({ id: m.id, ...m.data() }))
      .filter(md => inRange(md.fecha || md.createdAt))
      .map(md => {
        const tipo = String(md.tipo || md.tipoMedicion || "").trim();
        if (!tipo) return null;
        conteoTipos[tipo] = (conteoTipos[tipo] || 0) + 1;
        let productorIpt = '';
        let productorNombre = '';
        const prodField = String(md.productor || '').trim();
        if (/^\d+$/.test(prodField)) {
          const p = prodByIpt.get(prodField);
          productorIpt = prodField;
          productorNombre = p ? p.nombre : '';
        } else if (prodField) {
          const p = prodByName.get(prodField.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
          productorIpt = p ? p.ipt : '';
          productorNombre = p ? p.nombre : prodField;
        }
        const loteVal = md.lote || md.loteId || "";
        const loteStr = String(loteVal);
        const looksRandomId = /^[A-Za-z0-9]{16,}$/.test(loteStr);
        const f = md.fecha || md.createdAt;
        let fechaOut = '';
        try {
          let dt;
          if (f && typeof f === 'object' && (f._seconds || f.seconds)) {
            const secs = f._seconds ?? f.seconds;
            dt = new Date(secs * 1000);
          } else {
            dt = new Date(f);
          }
          const pad = (n)=> String(n).padStart(2,'0');
          const dd = pad(dt.getDate());
          const mm = pad(dt.getMonth()+1);
          const yyyy = dt.getFullYear();
          const hh = pad(dt.getHours());
          const min = pad(dt.getMinutes());
          fechaOut = `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
        } catch { fechaOut = String(f||''); }
        if (looksRandomId) return null;
        const unidadMap = { 'temperatura': '°C', 'ph': 'pH', 'humedad': '%' };
        const unidadMedida = unidadMap[norm(tipo)] || '';
        return {
          id: md.id,
          tipo,
          lote: loteStr,
          fecha: fechaOut,
          productorIpt,
          productorNombre,
          valorMedicion: md.valorNumerico ?? null,
          unidadMedida,
        };
      })
      .filter(Boolean);
    const medicionesFiltradas = medicionesLista.filter(r => {
      const tipo = String(r.tipo || '').toLowerCase();
      const lote = String(r.lote || '');
      const val = Number(r.valorMedicion || 0);
      if (tipo.includes('temperatura') && lote === 'Lote 12' && val >= 500) return false;
      if (tipo.includes('ph') && lote === 'Lote de Tabaco 1') return false;
      return true;
    });
    const medicionesResumen = { porTipo: conteoTipos, lista: medicionesFiltradas };

    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const ultima = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const data = {
      totalUsuarios: usuarios.length,
      totalProductoresActivos: productoresSnap.size,
      totalLotesActivos,
      totalTurnosActivos,
      totalMedicionesRegistradas,
      ultimaActualizacion: ultima,
      usuarios,
      lotesConDueno,
      insumosDisponibles,
      insumosAsignadosDetalle,
      actividadMovil,
      medicionesResumen,
    };

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener resumen general:", error);
    res.status(500).json({ message: "Error al obtener resumen general", error: error.message });
  }
};

// 👨‍🌾 Productores activos con métricas
export const obtenerProductoresActivos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };
    const productoresSnap = await db.collection("productores").where("activo", "==", true).get();
    const productores = [];

    for (const doc of productoresSnap.docs) {
      const productor = { id: doc.id, ...doc.data() };
      const iptProd = String(productor.ipt || "");

      const [lotesSnap, turnosByProdSnap, turnosByIptSnap] = await Promise.all([
        iptProd
          ? db.collection("lotes").where("ipt", "==", iptProd).where("activo", "==", true).get()
          : db.collection("lotes").where("productorId", "==", doc.id).get(),
        db.collection("turnos").where("productorId", "==", doc.id).where("activo", "==", true).get(),
        iptProd ? db.collection("turnos").where("ipt", "==", iptProd).where("activo", "==", true).get() : Promise.resolve({ docs: [] }),
      ]);

      const pad = (n)=> String(n).padStart(2,'0');
      const fmt = (f)=>{
        try{
          let dt;
          if (f && typeof f === 'object' && (f._seconds || f.seconds)) {
            const secs = f._seconds ?? f.seconds; dt = new Date(secs*1000);
          } else { dt = new Date(f); }
          if (isNaN(dt.getTime())) return '';
          return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()}, ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        }catch{ return String(f||''); }
      };

      // helper para calcular superficie (ha) a partir del polígono
      const calcHa = (pts) => {
        try {
          if (!Array.isArray(pts) || pts.length < 3) return 0;
          const R = 6378137; // radio terrestre (m)
          const lat0 = pts.reduce((a,p)=>a+p.lat,0)/pts.length * Math.PI/180;
          const toXY = (p)=>{
            const lat = p.lat * Math.PI/180, lng = p.lng * Math.PI/180;
            const x = R * lng * Math.cos(lat0);
            const y = R * lat;
            return { x, y };
          };
          let area = 0;
          for (let i=0,j=pts.length-1;i<pts.length;j=i++){
            const pi = toXY(pts[i]);
            const pj = toXY(pts[j]);
            area += (pj.x * pi.y) - (pi.x * pj.y);
          }
          area = Math.abs(area) / 2; // m^2
          const ha = area / 10000;
          return Number(ha.toFixed(4));
        } catch { return 0; }
      };

      const lotes = lotesSnap.docs
        .filter(d => inRange(d.data().fechaCreacion || d.data().createdAt))
        .map(d => ({
          id: d.id,
          nombre: d.data().nombre || d.data().ipt || d.id,
          ipt: String(d.data().ipt || ''),
          fechaCreacion: fmt(d.data().fechaCreacion || d.data().createdAt),
          updatedAt: fmt(d.data().updatedAt),
          estado: d.data().estado || 'Pendiente',
          superficie: (()=>{ const poly = Array.isArray(d.data().poligono) ? d.data().poligono.map(p=>({ lat: Number(p.lat), lng: Number(p.lng) })) : []; const s = Number(d.data().superficie); return (s && s>0) ? s : calcHa(poly); })(),
          metodo: d.data().metodoMarcado || d.data().metodo || '',
          observacionesProductor: d.data().observacionesProductor || '',
          poligono: Array.isArray(d.data().poligono) ? d.data().poligono.map(p=>({ lat: Number(p.lat), lng: Number(p.lng) })) : [],
        }));
      const turnosDocs = [...turnosByProdSnap.docs, ...turnosByIptSnap.docs];
      const seenTurno = new Set();
      const turnos = turnosDocs
        .filter(d => { if (seenTurno.has(d.id)) return false; seenTurno.add(d.id); return true; })
        .filter(d => inRange(d.data().fechaTurno || d.data().fecha || d.data().creadoEn))
        .map(d => ({
          id: d.id,
          tipo: d.data().tipoTurno || d.data().tipo || '',
          estado: String(d.data().estado || 'pendiente'),
          fecha: fmt(d.data().fechaTurno || d.data().fecha || d.data().creadoEn),
          ipt: String(d.data().ipt || iptProd || ''),
          productorNombre: productor.nombreCompleto || productor.nombre || '',
        }));
      productor.totalLotes = lotes.length;
      productor.totalTurnos = turnos.length;
      productor.lotes = lotes;
      productor.turnos = turnos;

      const uobj = productor.ubicaciones || {};
      const asCoord = (x)=> (x && typeof x === 'object' && typeof x.lat === 'number' && typeof x.lng === 'number') ? x : null;
      const ubicaciones = [];
      const ed = asCoord(uobj.entradaDomicilio || productor.domicilioIngresoCoord);
      const dc = asCoord(uobj.domicilioCasa);
      const ec = asCoord(uobj.entradaCampo);
      const cc = asCoord(uobj.centroCampo);
      if (ed) ubicaciones.push({ nombre: 'Entrada del domicilio', lat: ed.lat, lng: ed.lng });
      if (dc) ubicaciones.push({ nombre: 'Domicilio / casa', lat: dc.lat, lng: dc.lng });
      if (ec) ubicaciones.push({ nombre: 'Entrada del campo', lat: ec.lat, lng: ec.lng });
      if (cc) ubicaciones.push({ nombre: 'Centro del campo', lat: cc.lat, lng: cc.lng });
      productor.ubicaciones = ubicaciones;

      productores.push(productor);
    }

    res.json(productores);
  } catch (error) {
    console.error("❌ Error al obtener productores activos:", error);
    res.status(500).json({ message: "Error al obtener productores activos", error: error.message });
  }
};

// 🧾 Órdenes agrupadas por mes
export const obtenerOrdenesPorMes = async (req, res) => {
  try {
    const ordenesSnap = await db.collection("ordenes").where("activo", "==", true).get();
    const conteoPorMes = {};

    ordenesSnap.forEach((doc) => {
      const orden = doc.data();
      const fecha = new Date(orden.fecha);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      conteoPorMes[mes] = (conteoPorMes[mes] || 0) + 1;
    });

    const resultado = Object.entries(conteoPorMes).map(([mes, ordenes]) => ({ mes, ordenes }));
    res.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener órdenes por mes:", error);
    res.status(500).json({ message: "Error al obtener órdenes por mes", error: error.message });
  }
};

// 📊 Turnos agrupados por estado con total y porcentaje
export const obtenerTurnosPorEstado = async (req, res) => {
  try {
    const turnosSnap = await db.collection("turnos").where("activo", "==", true).get();

    // Inicializamos todos los estados en 0
    const conteo = {
      pendientes: 0,
      confirmados: 0,
      cancelados: 0,
      completados: 0,
      vencidos: 0,
    };

    // Contamos los turnos según su estado
    turnosSnap.forEach((doc) => {
      const estado = (doc.data().estado || "pendiente").toLowerCase();
      const clavePlural = estado + "s"; // convierte a plural
      if (conteo.hasOwnProperty(clavePlural)) {
        conteo[clavePlural]++;
      }
    });

    // Calculamos total de turnos
    const totalTurnos = Object.values(conteo).reduce((acc, val) => acc + val, 0);

    // Calculamos porcentaje por estado
    const porcentaje = {};
    for (const [key, value] of Object.entries(conteo)) {
      porcentaje[key] = totalTurnos > 0 ? ((value / totalTurnos) * 100).toFixed(2) : "0.00";
    }

    res.json({
      conteo,
      totalTurnos,
      porcentaje,
    });
  } catch (error) {
    console.error("❌ Error al obtener turnos por estado:", error);
    res.status(500).json({ message: "Error al obtener turnos por estado", error: error.message });
  }
};

// 🌱 Mediciones promedio por lote
export const obtenerMedicionesPorLote = async (req, res) => {
  try {
    const medicionesSnap = await db.collection("mediciones").get();
    const datosPorLote = {};

    medicionesSnap.forEach((doc) => {
      const { loteId, tipoMedicion, valor } = doc.data();
      if (!datosPorLote[loteId]) datosPorLote[loteId] = { totalMediciones: 0, sumaValores: 0 };

      datosPorLote[loteId].totalMediciones++;
      datosPorLote[loteId].sumaValores += valor || 0;
    });

    const resultado = Object.entries(datosPorLote).map(([loteId, data]) => ({
      loteId,
      promedioValor: data.totalMediciones ? data.sumaValores / data.totalMediciones : 0,
      totalMediciones: data.totalMediciones,
    }));

    res.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener mediciones por lote:", error);
    res.status(500).json({ message: "Error al obtener mediciones por lote", error: error.message });
  }
};

export const obtenerInsumosResumen = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const inRange = (raw) => {
      if (!start || !end) return true;
      if (!raw) return false;
      const d = raw._seconds ? new Date(raw._seconds * 1000) : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };
    const [asnap, insSnap, prodSnap] = await Promise.all([
      db.collection("productorInsumos").get(),
      db.collection("insumos").get(),
      db.collection("productores").get(),
    ]);
    const insMap = new Map(insSnap.docs.map(d => [d.id, d.data().nombre]));
    let totalAsignado = 0, totalEntregado = 0, totalPendiente = 0;
    const porInsumo = {};
    const porProductor = {};
    const prodById = new Map();
    prodSnap.docs.forEach(d => {
      const x = d.data();
      prodById.set(d.id, { nombre: x.nombreCompleto || x.nombre || '', ipt: String(x.ipt || '') });
    });
    asnap.docs.forEach(doc => {
      const a = doc.data();
      if (!inRange(a.fechaAsignacion)) return;
      const cant = Number(a.cantidadAsignada || 0);
      const estado = String(a.estado || 'pendiente').toLowerCase();
      const nombre = insMap.get(String(a.insumoId)) || String(a.insumoId);
      totalAsignado += cant;
      if (estado === 'entregado') totalEntregado += cant; else totalPendiente += cant;
      if (!porInsumo[nombre]) porInsumo[nombre] = { asignado: 0, entregado: 0, pendiente: 0 };
      porInsumo[nombre].asignado += cant;
      if (estado === 'entregado') porInsumo[nombre].entregado += cant; else porInsumo[nombre].pendiente += cant;
      const pid = String(a.productorId);
      if (!porProductor[pid]) {
        const info = prodById.get(pid) || { nombre: pid, ipt: '' };
        porProductor[pid] = { asignado: 0, entregado: 0, pendiente: 0, productorNombre: info.nombre, productorIpt: info.ipt };
      }
      porProductor[pid].asignado += cant;
      if (estado === 'entregado') porProductor[pid].entregado += cant; else porProductor[pid].pendiente += cant;
    });
    res.json({
      totalAsignado,
      totalEntregado,
      totalPendiente,
      porInsumo,
      porProductor,
      ultimaActualizacion: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: "Error en informe de insumos", error: error.message });
  }
};

export const obtenerTurnosEficiencia = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const start = fechaInicio ? new Date(`${fechaInicio}T00:00:00.000Z`) : null;
    const end = fechaFin ? new Date(`${fechaFin}T23:59:59.999Z`) : null;
    const snap = await db.collection("turnos").where("activo", "==", true).get();
    const conteo = { pendiente: 0, confirmado: 0, cancelado: 0, completado: 0, vencido: 0 };
    let sumaLeadDias = 0, leadCount = 0;
    snap.docs.forEach(d => {
      const t = d.data();
      if (start && end) {
        const ft = t.fechaTurno ? (t.fechaTurno._seconds ? new Date(t.fechaTurno._seconds * 1000) : (t.fechaTurno.seconds ? new Date(t.fechaTurno.seconds * 1000) : new Date(t.fechaTurno))) : (t.fecha ? new Date(t.fecha) : null);
        if (!ft || isNaN(ft.getTime()) || ft < start || ft > end) return;
      }
      const est = String(t.estado || 'pendiente').toLowerCase();
      if (conteo[est] !== undefined) conteo[est]++;
      const creado = t.creadoEn ? new Date(t.creadoEn) : null;
      const fechaTurno = t.fechaTurno ? new Date(t.fechaTurno) : (t.fecha ? new Date(t.fecha) : null);
      if (creado && fechaTurno && !isNaN(creado.getTime()) && !isNaN(fechaTurno.getTime())) {
        const diffMs = Math.abs(fechaTurno.getTime() - creado.getTime());
        const dias = diffMs / (1000*60*60*24);
        sumaLeadDias += dias;
        leadCount += 1;
      }
    });
    const totalTurnos = Object.values(conteo).reduce((a,b)=>a+b,0);
    const porcentaje = Object.fromEntries(Object.entries(conteo).map(([k,v])=>[k, totalTurnos ? ((v/totalTurnos)*100).toFixed(2) : "0.00"]));
    const leadTimePromedioDias = leadCount ? Number((sumaLeadDias/leadCount).toFixed(2)) : 0;
    res.json({ conteo, totalTurnos, porcentaje, leadTimePromedioDias });
  } catch (error) {
    res.status(500).json({ message: "Error en informe de turnos", error: error.message });
  }
};

// 🧾 Exportar PDF (placeholder)
export const exportarPDF = async (req, res) => {
  try {
    const { tipo } = req.query;
    res.json({ message: `Exportar informe a PDF - tipo solicitado: ${tipo}` });
  } catch (error) {
    console.error("❌ Error al exportar PDF:", error);
    res.status(500).json({ message: "Error al exportar PDF", error: error.message });
  }
};

// 📊 Exportar Excel (placeholder)
export const exportarExcel = async (req, res) => {
  try {
    const { tipo } = req.query;
    res.json({ message: `Exportar informe a Excel - tipo solicitado: ${tipo}` });
  } catch (error) {
    console.error("❌ Error al exportar Excel:", error);
    res.status(500).json({ message: "Error al exportar Excel", error: error.message });
  }
};
