import React, { useState } from "react";
import { lotesService } from "../services/lotes.service";
import { notify } from "../utils/alerts";

const LoteForm = () => {
  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await lotesService.createLote({ nombre, lat: parseFloat(lat), lng: parseFloat(lng) });
      setMessage("Lote creado correctamente.");
      notify({ title: "Lote creado correctamente", icon: "success" });
      setNombre("");
      setLat("");
      setLng("");
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "No se pudo crear el lote.");
    }
  };

  return (
    <div className="lotes-form">
      <form onSubmit={handleSubmit} className="max-w-md bg-white p-4 rounded shadow">
        <h2 className="text-xl mb-4 font-semibold">Crear Lote</h2>
        {message ? <div className="text-green-700 mb-2">{message}</div> : null}
        {error ? <div className="text-red-600 mb-2">{error}</div> : null}
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className="block w-full mb-2 border p-2 rounded"
        />
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitud"
          className="block w-full mb-2 border p-2 rounded"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitud"
          className="block w-full mb-2 border p-2 rounded"
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" type="submit">
          Guardar
        </button>
      </form>
    </div>
  );
};

export default LoteForm;
