// Endpoint de prueba para verificar el flujo completo
export const testFlujoTurno = async (req, res) => {
  try {
    console.log('🧪 TEST FLUJO TURNO - Iniciando prueba completa');
    console.log('📋 Headers recibidos:', req.headers);
    console.log('📦 Body recibido:', req.body);
    console.log('👤 Usuario:', req.user);
    
    const { fechaSolicitada, tipoTurno, ipt, motivo } = req.body;
    const productorId = req.user?.uid;
    
    console.log('📅 Fecha solicitada:', fechaSolicitada);
    console.log('🏷️ Tipo turno:', tipoTurno);
    console.log('📋 IPT:', ipt);
    console.log('🆔 Productor ID:', productorId);
    console.log('📝 Motivo:', motivo);
    
    // Log detallado de validaciones
    console.log('🔍 Validando datos...');
    console.log('   - Fecha solicitada presente:', !!fechaSolicitada);
    console.log('   - Tipo turno presente:', !!tipoTurno);
    console.log('   - Usuario autenticado:', !!productorId);
    
    if (!fechaSolicitada || !tipoTurno) {
      console.log('❌ Faltan datos requeridos');
      return res.status(400).json({ 
        error: true, 
        message: "Faltan datos requeridos: fechaSolicitada y tipoTurno",
        datosRecibidos: { fechaSolicitada, tipoTurno, ipt, motivo },
        debug: {
          fechaPresente: !!fechaSolicitada,
          tipoPresente: !!tipoTurno,
          usuarioPresente: !!productorId
        }
      });
    }
    
    // Validar formato de fecha
    const fecha = new Date(fechaSolicitada);
    console.log('📅 Fecha parseada:', fecha);
    console.log('📅 Es fecha válida:', !isNaN(fecha.getTime()));
    
    if (isNaN(fecha.getTime())) {
      console.log('❌ Fecha inválida');
      return res.status(400).json({ 
        error: true, 
        message: "Fecha inválida",
        fechaRecibida: fechaSolicitada,
        formatoEsperado: "YYYY-MM-DD"
      });
    }
    
    // Validar fin de semana
    const diaSemana = fecha.getDay();
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    console.log('📅 Día de la semana:', diasSemana[diaSemana], `(índice: ${diaSemana})`);
    
    if (diaSemana === 0 || diaSemana === 6) {
      console.log('❌ Fin de semana detectado');
      return res.status(400).json({ 
        error: true, 
        message: "No se permiten turnos sábado o domingo",
        diaSemana: diaSemana,
        nombreDia: diasSemana[diaSemana],
        fecha: fechaSolicitada
      });
    }
    
    // Normalizar tipo
    console.log('🔄 Normalizando tipo de turno...');
    const t = String(tipoTurno).toLowerCase().trim();
    console.log('   - Valor original:', tipoTurno);
    console.log('   - Valor en minúsculas:', t);
    
    let tipoNormalizado = "otra";
    if (t.includes("insumo")) tipoNormalizado = "insumo";
    else if (t.includes("renov")) tipoNormalizado = "carnet";
    
    console.log('✅ Tipo normalizado:', tipoNormalizado);
    
    // Simular creación sin guardar en BD
    const turnoSimulado = {
      productorId,
      tipoTurno: tipoNormalizado,
      fecha: fechaSolicitada,
      fechaTurno: fechaSolicitada,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      activo: true,
      ipt: ipt || "no proporcionado",
      motivo: motivo || ""
    };
    
    console.log('✅ Simulación exitosa');
    console.log('📋 Turno simulado:', turnoSimulado);
    
    res.json({
      success: true,
      message: "Test completado exitosamente - El turno se crearía correctamente",
      turno: turnoSimulado,
      validaciones: {
        fechaValida: true,
        noEsFinDeSemana: true,
        tipoNormalizado: tipoNormalizado,
        usuarioAutenticado: !!productorId,
        motivoIncluido: !!motivo
      },
      debug: {
        fechaProcesada: fecha,
        diaSemana: diasSemana[diaSemana],
        tipoOriginal: tipoTurno,
        tipoNormalizado: tipoNormalizado
      }
    });
    
  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({
      error: true,
      message: "Error en el test",
      errorDetalle: error.message,
      stack: error.stack
    });
  }
};