import api from '../api/axios'
export const getTurnos = async ()=>{ const res = await api.get('/ordenes'); 
    return res.data }
export const cancelTurno = async (id)=>{ const res = await api.delete(`/ordenes/${id}`); 
    return res.data }