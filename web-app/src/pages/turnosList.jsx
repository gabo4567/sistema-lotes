import React, { useEffect, useState } from 'react'
import { getTurnos, setEstadoTurno } from '../services/turnos.service'
import Layout from '../components/Layout'


const TurnosList = () => {
const [turnos, setTurnos] = useState([])


useEffect(()=>{(async ()=>{
try{ setTurnos(await getTurnos()) }catch(e){console.error(e)}
})()},[])


const handleCambioEstado = async (id, nuevo)=>{
  await setEstadoTurno(id, nuevo)
  setTurnos(turnos.map(t=> t.id===id ? { ...t, estado: nuevo } : t))
}


return (
<Layout>
<h2>Turnos</h2>
<ul>
{turnos.map(t=> (
  <li key={t.id} className="p-2 bg-white mb-2 rounded shadow flex justify-between">
    <div>
      <div>Productor: {t.productorId}</div>
      <div>Fecha: {t.fechaTurno}</div>
      <div>Tipo: {t.tipoTurno}</div>
      <div>Estado: {t.estado}</div>
    </div>
    <div className="flex gap-2">
      <select onChange={e=>handleCambioEstado(t.id, e.target.value)} defaultValue={t.estado}>
        <option value="Solicitado">Solicitado</option>
        <option value="Aprobado">Aprobado</option>
        <option value="Cancelado">Cancelado</option>
        <option value="Vencido">Vencido</option>
      </select>
    </div>
  </li>
))}
</ul>
</Layout>
)
}


export default TurnosList