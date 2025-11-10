import React, { useState } from 'react'
import { createLote } from '../services/lotes.service'
import Layout from '../components/Layout'


const LoteForm = () => {
const [nombre, setNombre] = useState('')
const [lat, setLat] = useState('')
const [lng, setLng] = useState('')


const handleSubmit = async (e)=>{
e.preventDefault()
try{
await createLote({ nombre, lat: parseFloat(lat), lng: parseFloat(lng) })
alert('Lote creado')
}catch(e){console.error(e); alert('Error')}
}


return (
<Layout>
<form onSubmit={handleSubmit} className="max-w-md bg-white p-4 rounded shadow">
<h2>Crear lote</h2>
<input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre" />
<input value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitud" />
<input value={lng} onChange={e=>setLng(e.target.value)} placeholder="Longitud" />
<button className="btn" type="submit">Guardar</button>
</form>
</Layout>
)
}


export default LoteForm