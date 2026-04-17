import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FileOperations from './pages/HEDemo'

function App() {
  const token = localStorage.getItem('token')
  return (
    <Routes>
      <Route path="/"           element={<Login />} />
      <Route path="/dashboard"  element={token ? <Dashboard />      : <Navigate to="/" />} />
      <Route path="/operations" element={token ? <FileOperations /> : <Navigate to="/" />} />
    </Routes>
  )
}

export default App