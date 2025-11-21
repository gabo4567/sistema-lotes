import React, { useEffect, useState } from 'react'
import { getInsumos } from '../services/insumos.service'
import Layout from '../components/Layout'


const InsumosList = () => {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{(async ()=>{
    try {
      setLoading(true)
      const data = await getInsumos()
      setInsumos(Array.isArray(data) ? data : [])
      setError('')
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar los insumos')
      setInsumos([])
    } finally { setLoading(false) }
  })()},[])

  return (
    <Layout>
      <h2>Insumos</h2>
      {error && <div className="text-red-600" style={{ marginBottom: 8 }}>{error}</div>}
      {loading ? (<div>Cargando…</div>) : (
        <ul>
          {insumos.length === 0 ? (
            <li className="p-2 bg-white mb-2 rounded shadow">No hay insumos disponibles</li>
          ) : (
            insumos.map(i=> (
              <li key={i.id} className="p-2 bg-white mb-2 rounded shadow">{i.nombre || 'Insumo'} — stock: {i.stock ?? '-'}</li>
            ))
          )}
        </ul>
      )}
    </Layout>
  )
}


export default InsumosList