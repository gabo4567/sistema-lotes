import React, { useState } from "react";
import { crearLote } from "../services/lotes.service";
import Layout from "../components/Layout";

const LoteForm = () => {
  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await crearLote({ nombre, lat: parseFloat(lat), lng: parseFloat(lng) });
      alert("✅ Lote creado correctamente");
      setNombre("");
      setLat("");
      setLng("");
    } catch (e) {
      console.error(e);
      alert("❌ Error al crear el lote");
    }
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="max-w-md bg-white p-4 rounded shadow">
        <h2 className="text-xl mb-4 font-semibold">Crear Lote</h2>
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
    </Layout>
  );
};

export default LoteForm;
