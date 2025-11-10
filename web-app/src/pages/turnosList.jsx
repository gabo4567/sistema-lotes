import React, { useEffect, useState } from 'react'
import { getTurnos, cancelTurno } from '../services/turnos.service'
import Layout from '../components/Layout'


const TurnosList = () => {
const [turnos, setTurnos] = useState([])


useEffect(()=>{(async ()=>{
try{ setTurnos(await getTurnos()) }catch(e){console.error(e)}
})()},[])


const handleCancel = async (id)=>{
if(!confirm('Cancelar turno?')) return
await cancelTurno(id)
setTurnos(turnos.filter(t=>t.id!==id))
}


return (
<Layout>
<h2>Turnos</h2>
<ul>
{turnos.map(t=> (
<li key={t.id} className="p-2 bg-white mb-2 rounded shadow flex justify-between">
<div>{t.productor_nombre} — {t.fecha} — Etapa {t.etapa}</div>
<div className="flex gap-2">
<button className="btn" onClick={()=>handleCancel(t.id)}>Cancelar</button>
</div>
</li>
))}
</ul>
</Layout>
)
}


export default TurnosList