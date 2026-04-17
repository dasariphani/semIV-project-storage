import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import ShaderBackground from '../components/ui/shader-background'

const API = 'http://127.0.0.1:8000'

export default function Vault() {
  const [files, setFiles]           = useState([])
  const [message, setMessage]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const navigate  = useNavigate()
  const token     = localStorage.getItem('token')
  const headers   = { Authorization: `Bearer ${token}` }

  useEffect(() => { fetchFiles() }, [])

  async function fetchFiles() {
    try {
      const res = await axios.get(`${API}/vault/files`, { headers })
      setFiles(res.data)
    } catch { setMessage('Failed to load vault') }
  }

  async function uploadFile(e) {
    const picked = Array.from(e.target.files)
    if (!picked.length) return
    setLoading(true)
    for (const file of picked) {
      const form = new FormData()
      form.append('file', file)
      try {
        await axios.post(`${API}/vault/upload`, form, {
          headers,
          onUploadProgress: p => setUploadProgress(Math.round(p.loaded * 100 / p.total))
        })
      } catch { setMessage(`Failed to upload ${file.name}`) }
    }
    setLoading(false)
    setUploadProgress(0)
    setMessage('Files encrypted and stored in vault!')
    fetchFiles()
  }

  async function combineFiles() {
    if (selected.length !== 2) {
      setMessage('Select exactly 2 files to combine')
      return
    }
    setLoading(true)
    try {
      const res = await axios.post(
        `${API}/vault/combine?vault_id1=${selected[0]}&vault_id2=${selected[1]}`,
        {}, { headers }
      )
      setMessage(`Combined! ${res.data.combined_name} — Server never saw plaintext ✓`)
      setSelected([])
      fetchFiles()
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Combine failed')
    }
    setLoading(false)
  }

  async function splitFile(vault_id) {
    setLoading(true)
    try {
      const res = await axios.post(`${API}/vault/split/${vault_id}`, {}, { headers })
      setMessage(`Split into ${res.data.restored.length} files!`)
      fetchFiles()
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Split failed')
    }
    setLoading(false)
  }

  async function downloadFile(vault_id, name) {
    try {
      const res = await axios.get(`${API}/vault/download/${vault_id}`, {
        headers, responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = name
      a.click()
    } catch { setMessage('Download failed') }
  }

  async function deleteFile(vault_id) {
    if (!window.confirm('Delete this file from vault?')) return
    try {
      await axios.delete(`${API}/vault/delete/${vault_id}`, { headers })
      setMessage('File deleted from vault')
      fetchFiles()
    } catch { setMessage('Delete failed') }
  }

  function toggleSelect(vault_id) {
    setSelected(prev =>
      prev.includes(vault_id)
        ? prev.filter(id => id !== vault_id)
        : prev.length < 2 ? [...prev, vault_id] : prev
    )
  }

  const regularFiles  = files.filter(f => !f.is_combined)
  const combinedFiles = files.filter(f => f.is_combined)

  return (
    <div style={s.container}>
     

      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Encrypted Vault</h2>
          <p style={s.subtitle}>All files encrypted with CKKS HE scheme — server sees only ciphertexts</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={s.outlineBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button style={s.outlineBtn} onClick={() => navigate('/demo')}>HE Demo</button>
        </div>
      </div>

      {/* Upload + Combine bar */}
      <div style={s.actionBar}>
        <label style={s.uploadBtn}>
          {loading ? `Encrypting... ${uploadProgress}%` : '+ Encrypt & Upload'}
          <input type="file" multiple style={{ display: 'none' }} onChange={uploadFile} />
        </label>

        {selected.length > 0 && (
          <div style={s.selectionInfo}>
            {selected.length} file{selected.length > 1 ? 's' : ''} selected
            {selected.length === 2 && (
              <button style={s.combineBtn} onClick={combineFiles}>
                Combine with HE Addition ➕
              </button>
            )}
            <button style={s.clearBtn} onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
      </div>

      {uploadProgress > 0 && (
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: uploadProgress + '%' }} />
        </div>
      )}

      {message && <div style={s.msg}>{message}</div>}

      {/* HE Info banner */}
      <div style={s.infoBanner}>
        <span style={{ color: '#a3e635' }}>✓ HE Active</span>
        &nbsp;— File metadata encrypted as CKKS vectors. Server performs addition on ciphertexts.
        Private key never leaves your browser session.
      </div>

      {/* Regular files */}
      <div style={s.sectionTitle}>
        Your Files ({regularFiles.length})
        <span style={s.sectionHint}>Select 2 files to combine them using HE addition</span>
      </div>

      {regularFiles.length === 0 && (
        <div style={s.empty}>No files yet. Upload files to get started.</div>
      )}

      <div style={s.grid}>
        {regularFiles.map(f => (
          <div
            key={f.vault_id}
            style={{
              ...s.fileCard,
              borderColor: selected.includes(f.vault_id) ? '#6366f1' : '#1e1e1e',
              boxShadow: selected.includes(f.vault_id) ? '0 0 0 2px #6366f1' : 'none'
            }}
          >
            <div style={s.fileTop}>
              <div style={s.fileIcon}>{f.display_name.split('.').pop().toUpperCase()}</div>
              <input
                type="checkbox"
                checked={selected.includes(f.vault_id)}
                onChange={() => toggleSelect(f.vault_id)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
            </div>

            <p style={s.filename}>{f.display_name}</p>
            <p style={s.fileMeta}>Size: {f.decrypted_size} bytes</p>
            <p style={s.fileMeta}>{f.created_at?.slice(0, 19)}</p>

            <div style={s.encTag}>
              <span style={{ color: '#a3e635' }}>⚡</span> CKKS Encrypted
            </div>

            <div style={s.encPreview}>
              <p style={s.encLabel}>Ciphertext preview (what server sees):</p>
              <p style={s.encValue}>{f.encrypted_meta_preview}</p>
            </div>

            <div style={s.cardActions}>
              <button style={s.btn} onClick={() => downloadFile(f.vault_id, f.display_name)}>Download</button>
              <button style={{ ...s.btn, color: '#f87171', borderColor: '#f87171' }} onClick={() => deleteFile(f.vault_id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Combined files */}
      {combinedFiles.length > 0 && <>
        <div style={{ ...s.sectionTitle, marginTop: '2rem' }}>
          Combined Files ({combinedFiles.length})
          <span style={s.sectionHint}>These were combined using HE addition on the server</span>
        </div>

        <div style={s.grid}>
          {combinedFiles.map(f => (
            <div key={f.vault_id} style={{ ...s.fileCard, borderColor: '#6366f133' }}>
              <div style={s.fileTop}>
                <div style={{ ...s.fileIcon, background: '#1e1e3e', color: '#818cf8' }}>ZIP</div>
                <span style={{ fontSize: '11px', color: '#818cf8' }}>Combined</span>
              </div>

              <p style={s.filename}>{f.display_name}</p>
              <p style={s.fileMeta}>Contains {f.combined_from.length} files</p>
              <p style={s.fileMeta}>{f.created_at?.slice(0, 19)}</p>

              <div style={s.encTag}>
                <span style={{ color: '#818cf8' }}>➕</span> HE Addition Applied
              </div>

              <div style={s.encPreview}>
                <p style={s.encLabel}>Combined ciphertext (server computed this):</p>
                <p style={s.encValue}>{f.encrypted_meta_preview}</p>
              </div>

              <div style={s.cardActions}>
                <button style={s.btn} onClick={() => downloadFile(f.vault_id, f.display_name)}>Download</button>
                <button style={{ ...s.btn, color: '#818cf8', borderColor: '#818cf8' }} onClick={() => splitFile(f.vault_id)}>Split Apart ➖</button>
                <button style={{ ...s.btn, color: '#f87171', borderColor: '#f87171' }} onClick={() => deleteFile(f.vault_id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </>}

    </div>
  )
}

const s = {
  container:    { minHeight: '100vh', background: '#0a0a0f', padding: '2rem', color: '#fff', fontFamily: 'sans-serif' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
  title:        { fontSize: '22px', fontWeight: '500', margin: '0 0 4px' },
  subtitle:     { fontSize: '12px', color: '#555', margin: 0 },
  outlineBtn:   { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  actionBar:    { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' },
  uploadBtn:    { background: '#6366f1', color: '#fff', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  selectionInfo:{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#aaa' },
  combineBtn:   { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  clearBtn:     { background: 'transparent', border: '1px solid #333', color: '#666', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' },
  progressBar:  { height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' },
  progressFill: { height: '100%', background: '#6366f1', transition: 'width 0.2s' },
  msg:          { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#a3e635', marginBottom: '1rem', wordBreak: 'break-all' },
  infoBanner:   { background: '#0f1a0f', border: '1px solid #1a3a1a', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#666', marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '14px', fontWeight: '500', color: '#888', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' },
  sectionHint:  { fontSize: '11px', color: '#444', fontWeight: '400' },
  empty:        { color: '#444', fontSize: '14px', textAlign: 'center', padding: '3rem 0' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  fileCard:     { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '16px', transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'default' },
  fileTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  fileIcon:     { background: '#1e1e2e', color: '#6366f1', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: '600' },
  filename:     { margin: '0 0 4px', fontSize: '14px', fontWeight: '500', color: '#fff', wordBreak: 'break-all' },
  fileMeta:     { margin: '0 0 2px', fontSize: '11px', color: '#444' },
  encTag:       { display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0f1a0f', border: '1px solid #1a3a1a', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#4ade80', margin: '8px 0' },
  encPreview:   { background: '#0a0a0a', borderRadius: '6px', padding: '8px 10px', margin: '8px 0' },
  encLabel:     { fontSize: '10px', color: '#333', margin: '0 0 4px' },
  encValue:     { fontSize: '10px', color: '#555', margin: 0, wordBreak: 'break-all', fontFamily: 'monospace' },
  cardActions:  { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' },
  btn:          { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
}