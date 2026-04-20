import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import ShaderBackground from '../components/ui/shader-background'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function Dashboard() {
  const [files, setFiles]                   = useState([])
  const [stats, setStats]                   = useState({ total_files: 0, total_size: 0, limit: 104857600 })
  const [activity, setActivity]             = useState([])
  const [message, setMessage]               = useState('')
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [activeTab, setActiveTab]           = useState('files')
  const [previewId, setPreviewId]           = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [search, setSearch]                 = useState('')
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const headers  = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchFiles()
    fetchStats()
  }, [])

  async function fetchAll() {
    fetchFiles()
    fetchStats()
  }

  async function fetchFiles(q = '') {
    try {
      const res  = await axios.get(`${API}/vault/files`, { headers })
      let data   = res.data
      if (q) data = data.filter(f => f.display_name.toLowerCase().includes(q.toLowerCase()))
      setFiles(data)
    } catch { setMessage('Failed to load files') }
  }

  async function fetchStats() {
    try {
      const res = await axios.get(`${API}/vault/stats`, { headers })
      setStats(res.data)
    } catch {}
  }

  async function fetchActivity() {
    try {
      const res = await axios.get(`${API}/vault/activity`, { headers })
      setActivity(res.data)
    } catch {}
  }

  async function uploadFile(e) {
    const picked = Array.from(e.target.files)
    if (!picked.length) return
    setUploading(true)
    for (const file of picked) {
      if (file.size > 10 * 1024 * 1024) { setMessage(`${file.name} too large. Max 10MB.`); continue }
      const form = new FormData()
      form.append('file', file)
      try {
        await axios.post(`${API}/vault/upload`, form, {
          headers,
          onUploadProgress: p => setUploadProgress(Math.round(p.loaded * 100 / p.total))
        })
      } catch { setMessage(`Failed to upload ${file.name}`) }
    }
    setUploading(false)
    setUploadProgress(0)
    setMessage('Files encrypted and stored!')
    fetchFiles()
    fetchStats()
  }

  async function deleteFile(vault_id) {
    if (!window.confirm('Delete this file?')) return
    try {
      await axios.delete(`${API}/vault/delete/${vault_id}`, { headers })
      setMessage('File deleted.')
      fetchFiles()
      fetchStats()
    } catch { setMessage('Delete failed') }
  }

  async function downloadFile(vault_id, name) {
    try {
      const res = await axios.get(`${API}/vault/download/${vault_id}`, { headers, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = name
      a.click()
    } catch { setMessage('Download failed') }
  }

  async function previewFile(vault_id) {
    if (previewId === vault_id) { setPreviewId(null); setPreviewContent(null); return }
    setPreviewId(vault_id)
    setPreviewLoading(true)
    try {
      const res = await axios.get(`${API}/vault/preview/${vault_id}`, { headers })
      setPreviewContent(res.data)
    } catch { setPreviewContent({ type: 'error' }) }
    setPreviewLoading(false)
  }

  async function shareFile(vault_id) {
    try {
      await navigator.clipboard.writeText(`${API}/vault/download/${vault_id}`)
      setMessage('Share link copied!')
    } catch { setMessage('Copy failed') }
  }

  function logout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  const usedPercent   = Math.min(100, Math.round((stats.total_size / stats.limit) * 100))
  const regularFiles  = files.filter(f => !f.is_combined)
  const combinedFiles = files.filter(f => f.is_combined)

  return (
    <div style={s.container}>
      <ShaderBackground />

      <div style={s.sidebar}>
        <div style={s.logo}>HE Storage</div>
        <div style={s.navItem(activeTab==='files')}    onClick={() => setActiveTab('files')}>Files</div>
        <div style={s.navItem(activeTab==='activity')} onClick={() => { setActiveTab('activity'); fetchActivity(); }}>Activity</div>
        <div style={s.navItem(false)} onClick={() => navigate('/operations')}>File Operations</div>
        <div style={{ flex: 1 }} />
        <div style={s.storageBox}>
          <p style={s.storageLabel}>Storage used</p>
          <div style={s.storageBar}>
            <div style={{ ...s.storageFill, width: usedPercent + '%' }} />
          </div>
          <p style={s.storageText}>{formatSize(stats.total_size)} / {formatSize(stats.limit)}</p>
        </div>
        <div style={s.navItem(false)} onClick={logout}>Logout</div>
      </div>

      <div style={s.main}>

        {activeTab === 'files' && <>
          <div style={s.topBar}>
            <input
              style={s.search}
              placeholder="Search files..."
              value={search}
              onChange={e => { setSearch(e.target.value); fetchFiles(e.target.value) }}
            />
            <label style={s.uploadBtn}>
              {uploading ? `Encrypting... ${uploadProgress}%` : '+ Upload Files'}
              <input type="file" multiple style={{ display: 'none' }} onChange={uploadFile} />
            </label>
          </div>

          {uploading && (
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: uploadProgress + '%' }} />
            </div>
          )}

          {message && <p style={s.msg}>{message}</p>}

          <div style={s.statsRow}>
            <div style={s.statCard}>
              <p style={s.statNum}>{stats.total_files}</p>
              <p style={s.statLabel}>Total Files</p>
            </div>
            <div style={s.statCard}>
              <p style={s.statNum}>{formatSize(stats.total_size)}</p>
              <p style={s.statLabel}>Storage Used</p>
            </div>
            <div style={s.statCard}>
              <p style={s.statNum}>CKKS</p>
              <p style={s.statLabel}>HE Scheme</p>
            </div>
          </div>

          {files.length === 0 && <p style={s.empty}>No files yet. Upload your first file above.</p>}

          {regularFiles.length > 0 && <p style={s.sectionLabel}>Your Files ({regularFiles.length})</p>}
          {regularFiles.map(f => (
            <div key={f.vault_id} style={s.fileCard}>
              <div style={s.fileLeft}>
                <div style={s.fileIcon}>{f.display_name.split('.').pop().toUpperCase()}</div>
                <div>
                  <p style={s.filename}>{f.display_name}</p>
                  <p style={s.fileMeta}>{f.decrypted_size} bytes · {f.created_at?.slice(0,19)}</p>
                  <div style={s.encTag}>⚡ CKKS Encrypted</div>
                </div>
              </div>
              <div style={s.actions}>
                <button style={s.btn} onClick={() => previewFile(f.vault_id)}>
                  {previewId === f.vault_id ? 'Hide' : 'Preview'}
                </button>
                <button style={s.btn} onClick={() => downloadFile(f.vault_id, f.display_name)}>Download</button>
                <button style={s.btn} onClick={() => shareFile(f.vault_id)}>Copy Link</button>
                <button style={{ ...s.btn, color: '#f87171', borderColor: '#f87171' }} onClick={() => deleteFile(f.vault_id)}>Delete</button>
              </div>
              {previewId === f.vault_id && (
                <div style={s.preview}>
                  {previewLoading && <p style={{ color: '#666', fontSize: '13px' }}>Loading...</p>}
                  {previewContent?.type === 'text' && (
                    <pre style={s.previewText}>{previewContent.content}</pre>
                  )}
                  {previewContent?.type === 'image' && (
                    <img src={`data:${previewContent.mime};base64,${previewContent.content}`}
                      alt={f.display_name}
                      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px' }} />
                  )}
                  {previewContent?.type === 'pdf' && (
                    <iframe src={`data:application/pdf;base64,${previewContent.content}`}
                      style={{ width: '100%', height: '400px', border: 'none', borderRadius: '6px' }}
                      title={f.display_name} />
                  )}
                  {previewContent?.type === 'unsupported' && (
                    <p style={{ color: '#666', fontSize: '13px' }}>Preview not available. Use Download.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {combinedFiles.length > 0 && <>
            <p style={{ ...s.sectionLabel, marginTop: '1.5rem' }}>Combined Files ({combinedFiles.length})</p>
            {combinedFiles.map(f => (
              <div key={f.vault_id} style={{ ...s.fileCard, borderColor: '#6366f133' }}>
                <div style={s.fileLeft}>
                  <div style={{ ...s.fileIcon, background: '#1e1e3e', color: '#818cf8' }}>ZIP</div>
                  <div>
                    <p style={s.filename}>{f.display_name}</p>
                    <p style={s.fileMeta}>Combined · {f.created_at?.slice(0,19)}</p>
                    <div style={{ ...s.encTag, color: '#818cf8' }}>➕ HE Addition</div>
                  </div>
                </div>
                <div style={s.actions}>
                  <button style={s.btn} onClick={() => downloadFile(f.vault_id, f.display_name)}>Download</button>
                  <button style={{ ...s.btn, color: '#f87171', borderColor: '#f87171' }} onClick={() => deleteFile(f.vault_id)}>Delete</button>
                </div>
              </div>
            ))}
          </>}
        </>}

        {activeTab === 'activity' && <>
          <h3 style={{ color: '#fff', fontWeight: '500', marginBottom: '1rem' }}>Activity Log</h3>
          {activity.length === 0 && <p style={s.empty}>No activity yet.</p>}
          {activity.map((a, i) => (
            <div key={i} style={s.actCard}>
              <span style={{ ...s.actTag, background: a.action === 'upload' ? '#16a34a' : '#9333ea' }}>
                {a.action}
              </span>
              <span style={{ color: '#ccc', fontSize: '13px', flex: 1 }}>{a.detail}</span>
              <span style={{ color: '#555', fontSize: '12px' }}>{a.time?.slice(0,19)}</span>
            </div>
          ))}
        </>}

      </div>
    </div>
  )
}

const s = {
  container:    { display: 'flex', minHeight: '100vh', background: 'transparent', color: '#fff', fontFamily: 'sans-serif' },
  sidebar:      { width: '220px', background: 'rgba(10,10,15,0.85)', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', gap: '4px', flexShrink: 0 },
  logo:         { fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '1.5rem', paddingLeft: '8px' },
  navItem:      (active) => ({ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: active ? '#1e1e2e' : 'transparent', color: active ? '#6366f1' : '#888' }),
  storageBox:   { background: 'rgba(26,26,26,0.8)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' },
  storageLabel: { fontSize: '11px', color: '#555', margin: '0 0 6px' },
  storageBar:   { height: '4px', background: '#2a2a2a', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' },
  storageFill:  { height: '100%', background: '#6366f1', borderRadius: '2px', transition: 'width 0.3s' },
  storageText:  { fontSize: '11px', color: '#666', margin: 0 },
  main:         { flex: 1, padding: '2rem', overflowY: 'auto' },
  topBar:       { display: 'flex', gap: '12px', marginBottom: '1rem', alignItems: 'center' },
  search:       { flex: 1, background: 'rgba(26,26,26,0.8)', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '9px 14px', color: '#fff', fontSize: '13px' },
  uploadBtn:    { background: '#6366f1', color: '#fff', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
  progressBar:  { height: '4px', background: '#2a2a2a', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' },
  progressFill: { height: '100%', background: '#6366f1', transition: 'width 0.2s' },
  msg:          { color: '#a3e635', fontSize: '12px', margin: '0 0 1rem', wordBreak: 'break-all' },
  statsRow:     { display: 'flex', gap: '12px', marginBottom: '1.5rem' },
  statCard:     { flex: 1, background: 'rgba(26,26,26,0.8)', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px 16px' },
  statNum:      { fontSize: '20px', fontWeight: '500', margin: '0 0 2px', color: '#fff' },
  statLabel:    { fontSize: '11px', color: '#555', margin: 0 },
  empty:        { color: '#444', fontSize: '14px', textAlign: 'center', marginTop: '3rem' },
  sectionLabel: { fontSize: '12px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fileCard:     { background: 'rgba(17,17,17,0.85)', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' },
  fileLeft:     { display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 },
  fileIcon:     { background: '#1e1e2e', color: '#6366f1', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: '600', flexShrink: 0 },
  filename:     { margin: '0 0 2px', fontSize: '14px', fontWeight: '500' },
  fileMeta:     { margin: '0 0 4px', fontSize: '12px', color: '#444' },
  encTag:       { display: 'inline-block', background: '#0f1a0f', border: '1px solid #1a3a1a', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#4ade80' },
  actions:      { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  btn:          { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  preview:      { width: '100%', background: 'rgba(10,10,10,0.9)', borderRadius: '8px', padding: '12px', marginTop: '4px', border: '1px solid #1e1e1e' },
  previewText:  { color: '#ccc', fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflowY: 'auto', margin: 0 },
  actCard:      { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(17,17,17,0.85)', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' },
  actTag:       { fontSize: '11px', padding: '2px 8px', borderRadius: '10px', color: '#fff', fontWeight: '500', flexShrink: 0 },
}