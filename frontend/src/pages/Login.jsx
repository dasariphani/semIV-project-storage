import ShaderBackground from '../components/ui/shader-background'
import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const API = '/api'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isRegister, setIsRegister] = useState(false)
    const [message, setMessage] = useState('')
    const navigate = useNavigate()

    async function handleSubmit() {
        try {
            if (isRegister) {
                await axios.post(`${API}/auth/register`, { email, password })
                setMessage('Registered successfully! Please login.')
                setIsRegister(false)
            } else {
                const form = new URLSearchParams()
                form.append('username', email)
                form.append('password', password)
                const res = await axios.post(`${API}/auth/login`, form, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })
                localStorage.setItem('token', res.data.access_token)
                navigate('/dashboard')
            }
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Something went wrong')
        }
    }

    return (
        <div style={styles.container}>
      <ShaderBackground />
            <div style={styles.card}>
                <h2 style={styles.title}>HE Cloud Storage</h2>
                <p style={styles.subtitle}>{isRegister ? 'Create an account' : 'Sign in to your account'}</p>

                <input
                    style={styles.input}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <input
                    style={styles.input}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />

                {message && <p style={styles.message}>{message}</p>}

                <button style={styles.button} onClick={handleSubmit}>
                    {isRegister ? 'Register' : 'Login'}
                </button>

                <p style={styles.toggle}>
                    {isRegister ? 'Already have an account?' : "Don't have an account?"}
                    <span style={styles.link} onClick={() => setIsRegister(!isRegister)}>
                        {isRegister ? ' Login' : ' Register'}
                    </span>
                </p>
            </div>
        </div>
    )
}

const styles = {
   container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
  },
    card: {
        background: '#1a1a1a',
        padding: '2rem',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #2a2a2a',
    },
    title: {
        color: '#ffffff',
        fontSize: '22px',
        fontWeight: '500',
        margin: '0 0 6px',
        textAlign: 'center',
    },
    subtitle: {
        color: '#888',
        fontSize: '13px',
        textAlign: 'center',
        margin: '0 0 1.5rem',
    },
    input: {
        width: '100%',
        padding: '10px 14px',
        marginBottom: '12px',
        borderRadius: '8px',
        border: '1px solid #2a2a2a',
        background: '#111',
        color: '#fff',
        fontSize: '14px',
        boxSizing: 'border-box',
    },
    button: {
        width: '100%',
        padding: '10px',
        borderRadius: '8px',
        border: 'none',
        background: '#6366f1',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        marginTop: '4px',
    },
    message: {
        color: '#f87171',
        fontSize: '12px',
        margin: '0 0 10px',
        textAlign: 'center',
    },
    toggle: {
        color: '#888',
        fontSize: '12px',
        textAlign: 'center',
        marginTop: '1rem',
    },
    link: {
        color: '#6366f1',
        cursor: 'pointer',
    }
}