import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getProductorById,
  getHistorialIngresos,
} from "../services/productores.service";

import { insumosService } from "../services/insumos.service";
import LoadingState from "../components/LoadingState";
import DismissibleAlert from "../components/DismissibleAlert";

const DetailField = ({ label, value, wide = false }) => (
  <div className={`producer-field ${wide ? "producer-field--wide" : ""}`}>
    <div className="producer-field__label">{label}</div>

    <div className="producer-field__value">
      {value === 0 || value ? value : "-"}
    </div>
  </div>
);

const ProductorDetail = () => {

  const { id } = useParams();

  const [prod, setProd] = useState(null);

  const [hist, setHist] = useState(null);

  const [insumos, setInsumos] = useState([]);
  const [catalogoInsumos, setCatalogoInsumos] = useState([]);
  const [insumosLoading, setInsumosLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [histLoading, setHistLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {

    let alive = true;

    (async () => {

      try {

        setLoading(true);

        setHistLoading(false);
        setInsumosLoading(false);

        setProd(null);
        setHist(null);
        setInsumos([]);

        setError("");

        const { data } = await getProductorById(id);

        if (!alive) return;

        setProd(data);

        // catálogo de insumos
        try {

          const catalogo =
            await insumosService.getInsumos();

          if (!alive) return;

          setCatalogoInsumos(
            Array.isArray(catalogo)
              ? catalogo
              : []
          );

        } catch {

          setCatalogoInsumos([]);

        }

        if (data?.ipt) {

          // historial
          setHistLoading(true);

          const { data: h } =
            await getHistorialIngresos(data.ipt);

          if (!alive) return;

          setHist(
            typeof h === "object" &&
            h !== null &&
            "historialIngresos" in h
              ? h.historialIngresos
              : h
          );

          // insumos
          setInsumosLoading(true);

          try {

            const asignaciones =
              await insumosService.asignacionesPorProductor(
                data.ipt
              );

            if (!alive) return;

            setInsumos(
              Array.isArray(asignaciones)
                ? asignaciones
                : []
            );

          } catch {

            setInsumos([]);

          } finally {

            setInsumosLoading(false);
          }

        } else {

          setHist([]);
          setInsumos([]);
        }

      } catch {

        if (alive) {
          setError("No se pudo cargar productor");
        }

      } finally {

        if (alive) {

          setLoading(false);
          setHistLoading(false);
        }
      }

    })();

    return () => {
      alive = false;
    };

  }, [id]);

  // nombres lindos de insumos
  const obtenerNombreInsumo = (insumoId) => {

    const encontrado = catalogoInsumos.find(
      (i) =>
        i.id === insumoId ||
        i.insumoId === insumoId
    );

    return (
      encontrado?.nombre ||
      insumoId
        ?.replaceAll("insumo-", "")
        ?.replaceAll("-", " ")
        ?.toUpperCase() ||
      "-"
    );
  };

  return (

    <div className="section-card prod-detail page-container">

      {loading && !prod ? (

        <LoadingState
          title="Cargando productor..."
          message="Estamos preparando la informacion del productor. Espera unos segundos."
        />

      ) : !prod ? (

        <div className="producer-detail-loading">
          No se pudo mostrar el productor.
        </div>

      ) : (

        <>

          <h2 className="users-title">
            {prod.nombreCompleto || "Productor"}
          </h2>

          <div className="producer-detail-grid">

            <DetailField
              label="IPT"
              value={prod.ipt}
            />

            <DetailField
              label="CUIL"
              value={prod.cuil}
            />

            <DetailField
              label="Email"
              value={prod.email}
              wide
            />

            <DetailField
              label="Teléfono"
              value={prod.telefono}
            />

            <DetailField
              label="Localidad"
              value={prod.domicilioCasa}
            />

            {/* tipo productor */}
            <DetailField
              label="Tipo productor"
              value={prod.estado}
            />

            {/* estado operativo */}
            <DetailField
              label="Estado productor"
              value={
                prod.activo === false
                  ? "Inactivo"
                  : "Activo"
              }
            />

            {/* estado carnet */}
            <DetailField
              label="Estado carnet"
              value={prod.estadoCarnet || "Vigente"}
            />

            {/* vencimiento carnet */}
            <DetailField
              label="Vencimiento carnet"
              value={
                prod.fechaVencimientoCarnet
                  ? new Date(
                      prod.fechaVencimientoCarnet
                    ).toLocaleDateString("es-AR")
                  : "-"
              }
            />

            <DetailField
              label="Cambio de contraseña"
              value={
                prod.requiereCambioContrasena
                  ? "Requerido"
                  : "No requerido"
              }
            />

          </div>

          {/* HISTORIAL */}

          <h3 className="producer-section-title">
            Historial de ingresos
          </h3>

          {histLoading ? (

            <LoadingState
              compact
              title="Cargando historial..."
              message="Estamos consultando los ingresos del productor."
            />

          ) : Array.isArray(hist) && hist.length > 0 ? (

            <div className="producer-detail-grid">

              {hist.map((h, idx) => (

                <React.Fragment key={idx}>

                  <DetailField
                    label="Fecha"
                    value={
                      h.fecha
                        ? new Date(
                            h.fecha
                          ).toLocaleDateString("es-AR")
                        : "-"
                    }
                  />

                  <DetailField
                    label="Acción"
                    value={h.accion || "-"}
                  />

                  <DetailField
                    label="Observación"
                    value={h.observacion || "-"}
                    wide
                  />

                </React.Fragment>

              ))}

            </div>

          ) : typeof hist === "number" ? (

            <div className="producer-detail-grid">

              <DetailField
                label="Ingresos totales"
                value={hist}
                wide
              />

            </div>

          ) : (

            <div className="producer-detail-empty">
              Sin datos de ingresos registrados.
            </div>

          )}

          {/* INSUMOS */}

          <h3 className="producer-section-title">
            Insumos asignados
          </h3>

          {insumosLoading ? (

            <LoadingState
              compact
              title="Cargando insumos..."
              message="Estamos consultando las asignaciones del productor."
            />

          ) : Array.isArray(insumos) &&
            insumos.length > 0 ? (

            <div className="producer-detail-grid">

              {insumos.map((i) => (

                <React.Fragment key={i.id}>

                  <DetailField
                    label="Insumo"
                    value={obtenerNombreInsumo(i.insumoId)}
                  />

                  <DetailField
                    label="Cantidad asignada"
                    value={i.cantidadAsignada || 0}
                  />

                  <DetailField
                    label="Cantidad entregada"
                    value={i.cantidadEntregada || 0}
                  />

                  <DetailField
                    label="Estado"
                    value={i.estado || "-"}
                  />

                </React.Fragment>

              ))}

            </div>

          ) : (

            <div className="producer-detail-empty">
              Sin insumos asignados.
            </div>

          )}

          {error && (

            <DismissibleAlert
              className="users-msg err"
              style={{ marginTop: 8 }}
            >
              {error}
            </DismissibleAlert>

          )}

        </>
      )}
    </div>
  );
};

export default ProductorDetail;
