import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import ShaderBackground from '../components/ui/shader-background'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function FileOperations() {
  const [files, setFiles]       = useState([])
  const [selected, setSelected] = useState([])
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [log, setLog]           = useState([])
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const headers  = { Authorization: `Bearer ${token}` }

  useEffect(() => { fetchFiles() }, [])

  async function fetchFiles() {
    try {
      const res = await axios.get(`${API}/vault/files`, { headers })
      setFiles(res.data)
    } catch { setMessage('Failed to load files') }
  }

  function toggleSelect(vault_id) {
    setSelected(prev =>
      prev.includes(vault_id)
        ? prev.filter(id => id !== vault_id)
        : prev.length < 2 ? [...prev, vault_id] : prev
    )
  }

  function addLog(text, color = '#a3e635') {
    setLog(prev => [...prev, { text, color, time: new Date().toLocaleTimeString() }])
  }

  async function combineFiles() {
    if (selected.length !== 2) { setMessage('Select exactly 2 files to combine'); return }
    setLoading(true)
    setLog([])
    addLog('Step 1 — Reading encrypted metadata of both files...')
    try {
      addLog('Step 2 — Sending ciphertexts to server for HE addition...')
      const res = await axios.post(
        `${API}/vault/combine?vault_id1=${selected[0]}&vault_id2=${selected[1]}`,
        {}, { headers }
      )
      addLog('Step 3 — Server performed HE addition on ciphertexts (never decrypted) ✓')
      addLog(`Step 4 — Combined file created: ${res.data.combined_name} ✓`)
      addLog('Step 5 — Encrypted bundle stored in vault ✓')
      setMessage('Combined! Server saw NO plaintext.')
      setSelected([])
      fetchFiles()
    } catch (err) {
      addLog('Error: ' + (err.response?.data?.detail || err.message), '#f87171')
    }
    setLoading(false)
  }

  async function splitFile() {
    const combinedFiles = files.filter(f => f.is_combined && selected.includes(f.vault_id))
    if (!combinedFiles.length) { setMessage('Select a combined file to split'); return }
    setLoading(true)
    setLog([])
    addLog('Step 1 — Reading combined encrypted bundle...')
    try {
      addLog('Step 2 — Identifying original file references...')
      const res = await axios.post(`${API}/vault/split/${combinedFiles[0].vault_id}`, {}, { headers })
      addLog(`Step 3 — Split into ${res.data.restored.length} original files ✓`)
      res.data.restored.forEach(r => addLog(`  → Restored: ${r.display_name} ✓`, '#818cf8'))
      addLog('Step 4 — Combined bundle removed from vault ✓')
      setMessage('Files split successfully!')
      setSelected([])
      fetchFiles()
    } catch (err) {
      addLog('Error: ' + (err.response?.data?.detail || err.message), '#f87171')
    }
    setLoading(false)
  }

  const regularFiles     = files.filter(f => !f.is_combined)
  const combinedFiles    = files.filter(f => f.is_combined)
  const selectedCombined = files.filter(f => f.is_combined && selected.includes(f.vault_id))

  return (
    <div style={s.container}>
      <ShaderBackground />

      <div style={s.header}>
        <div>
          <h2 style={s.title}>File Operations</h2>
          <p style={s.subtitle}>Combine or split files using Homomorphic Encryption — server never sees plaintext</p>
        </div>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
      </div>

      <div style={s.layout}>

        {/* Left panel — file picker */}
        <div style={s.panel}>
          <p style={s.panelTitle}>Your Files — select up to 2</p>
          {regularFiles.length === 0 && (
            <p style={s.empty}>No files. Upload from Dashboard first.</p>
          )}
          {regularFiles.map(f => (
            <div
              key={f.vault_id}
              style={{
                ...s.fileRow,
                borderColor: selected.includes(f.vault_id) ? '#6366f1' : '#1e1e1e',
                background:  selected.includes(f.vault_id) ? 'rgba(30,30,46,0.9)' : 'rgba(17,17,17,0.85)'
              }}
              onClick={() => toggleSelect(f.vault_id)}
            >
              <input
                type="checkbox"
                checked={selected.includes(f.vault_id)}
                onChange={() => toggleSelect(f.vault_id)}
                style={{ cursor: 'pointer' }}
              />
              <div style={s.fileIcon}>{f.display_name.split('.').pop().toUpperCase()}</div>
              <div>
                <p style={s.filename}>{f.display_name}</p>
                <p style={s.fileMeta}>{f.decrypted_size} bytes</p>
              </div>
            </div>
          ))}

          {combinedFiles.length > 0 && <>
            <p style={{ ...s.panelTitle, marginTop: '1.5rem' }}>Combined Files</p>
            {combinedFiles.map(f => (
              <div
                key={f.vault_id}
                style={{
                  ...s.fileRow,
                  borderColor: selected.includes(f.vault_id) ? '#818cf8' : '#1e1e1e',
                  background:  selected.includes(f.vault_id) ? 'rgba(30,30,46,0.9)' : 'rgba(17,17,17,0.85)'
                }}
                onClick={() => toggleSelect(f.vault_id)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(f.vault_id)}
                  onChange={() => toggleSelect(f.vault_id)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ ...s.fileIcon, background: '#1e1e3e', color: '#818cf8' }}>ZIP</div>
                <div>
                  <p style={s.filename}>{f.display_name}</p>
                  <p style={{ ...s.fileMeta, color: '#818cf8' }}>Combined file</p>
                </div>
              </div>
            ))}
          </>}
        </div>

        {/* Right panel — operations */}
        <div style={s.panel}>
          <p style={s.panelTitle}>Operations</p>

          <div style={s.opCard}>
            <div style={s.opHeader}>
              <span style={s.opIcon}>➕</span>
              <div>
                <p style={s.opTitle}>Combine Files</p>
                <p style={s.opDesc}>Select 2 regular files — server adds their encrypted metadata using HE addition without decrypting</p>
              </div>
            </div>
            <button
              style={{ ...s.opBtn, opacity: selected.length === 2 && !selectedCombined.length ? 1 : 0.4 }}
              disabled={selected.length !== 2 || selectedCombined.length > 0 || loading}
              onClick={combineFiles}
            >
              {loading ? 'Processing...' : 'Combine Selected Files'}
            </button>
            {selected.length !== 2 && <p style={s.opHint}>Select exactly 2 regular files above</p>}
          </div>

          <div style={s.opCard}>
            <div style={s.opHeader}>
              <span style={s.opIcon}>➖</span>
              <div>
                <p style={s.opTitle}>Split File</p>
                <p style={s.opDesc}>Select a combined file — splits it back into its original separate files</p>
              </div>
            </div>
            <button
              style={{ ...s.opBtn, background: '#818cf8', opacity: selectedCombined.length === 1 ? 1 : 0.4 }}
              disabled={selectedCombined.length !== 1 || loading}
              onClick={splitFile}
            >
              {loading ? 'Processing...' : 'Split Selected File'}
            </button>
            {selectedCombined.length === 0 && <p style={s.opHint}>Select a combined file above</p>}
          </div>

          {log.length > 0 && (
            <div style={s.logBox}>
              <p style={s.panelTitle}>Operation Log</p>
              {log.map((l, i) => (
                <div key={i} style={{ fontSize: '12px', color: l.color, padding: '3px 0', lineHeight: 1.6 }}>
                  <span style={{ color: '#333', marginRight: '8px' }}>{l.time}</span>
                  {l.text}
                </div>
              ))}
            </div>
          )}

          {message && <div style={s.msg}>{message}</div>}
        </div>

      </div>
    </div>
  )
}

const s = {
  container:  { minHeight: '100vh', background: 'transparent', padding: '2rem', color: '#fff', fontFamily: 'sans-serif' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  title:      { fontSize: '22px', fontWeight: '500', margin: '0 0 4px' },
  subtitle:   { fontSize: '12px', color: '#555', margin: 0 },
  backBtn:    { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  layout:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  panel:      { background: 'rgba(10,10,15,0.85)', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '1.5rem' },
  panelTitle: { fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1rem' },
  empty:      { color: '#444', fontSize: '13px', textAlign: 'center', padding: '2rem 0' },
  fileRow:    { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.15s' },
  fileIcon:   { background: '#1e1e2e', color: '#6366f1', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', fontWeight: '600', flexShrink: 0 },
  filename:   { margin: '0 0 2px', fontSize: '13px', fontWeight: '500' },
  fileMeta:   { margin: 0, fontSize: '11px', color: '#444' },
  opCard:     { background: 'rgba(10,10,10,0.8)', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' },
  opHeader:   { display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' },
  opIcon:     { fontSize: '20px', flexShrink: 0 },
  opTitle:    { fontSize: '14px', fontWeight: '500', margin: '0 0 4px' },
  opDesc:     { fontSize: '12px', color: '#555', margin: 0, lineHeight: 1.5 },
  opBtn:      { width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  opHint:     { fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '6px' },
  logBox:     { background: 'rgba(10,10,10,0.8)', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '12px', marginBottom: '1rem' },
  msg:        { color: '#a3e635', fontSize: '12px', marginTop: '1rem', wordBreak: 'break-all' },
}