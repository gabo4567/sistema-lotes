import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'


const Navbar = () => {
const { user, logout } = useContext(AuthContext)
return (
<nav className="bg-white shadow p-3 flex justify-between">
  <div className="flex gap-4 items-center">
    <Link className="nav link" to="/home">SISTEMA-LOTES</Link>
    <Link className="nav link" to="/lotes">Lotes</Link>
    <Link className="nav link" to="/turnos">Turnos</Link>
    <Link className="nav link" to="/insumos">Insumos</Link>
    <Link className="nav link" to="/productores">Productores</Link>
    <Link className="nav link" to="/mediciones">Mediciones</Link>
    <Link className="nav link" to="/informes">Informes</Link>
    <Link className="nav link" to="/users">Usuarios</Link>
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