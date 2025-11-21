import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'


const Navbar = () => {
const { user, logout } = useContext(AuthContext)
return (
<nav className="bg-white shadow p-3 flex justify-between">
  <div className="flex gap-4 items-center">
    <Link to="/">SISTEMA-LOTES</Link>
    <Link to="/lotes">Lotes</Link>
    <Link to="/turnos">Turnos</Link>
    <Link to="/insumos">Insumos</Link>
    <Link to="/productores">Productores</Link>
    <Link to="/mediciones">Mediciones</Link>
    <Link to="/informes">Informes</Link>
    <Link to="/users">Usuarios</Link>
  </div>
<div>
{user ? (
<button onClick={logout} className="btn">Salir</button>
) : (
    <Link to="/">Login</Link>
)}
</div>
</nav>
)
}


export default Navbar