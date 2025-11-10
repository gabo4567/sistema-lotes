import api from '../api/axios'
export const getInsumos = async ()=>{ const res = await api.get('/ordenes/insumos') ; 
    return res.data }