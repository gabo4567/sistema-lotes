import React, { useEffect, useState } from 'react'
import { getInsumos } from '../services/insumos.service'
import Layout from '../components/Layout'


const InsumosList = () => {
const [insumos, setInsumos] = useState([])
useEffect(()=>{(async ()=>{ setInsumos(await getInsumos()) })()},[])
return (
<Layout>
<h2>Insumos</h2>
<ul>
{insumos.map(i=> <li key={i.id} className="p-2 bg-white mb-2 rounded shadow">{i.nombre} — stock: {i.stock}</li>)}
</ul>
</Layout>
)
}


export default InsumosList