import { useRef, useState } from 'react'
import { useLibraryStore } from '../stores/libraryStore'

export default function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null)
  const { importFiles } = useLibraryStore()
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, fileName: '' })

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setImporting(true)
    setProgress({ current: 0, total: files.length, fileName: '' })
    try {
      const result = await importFiles(files, (current, total, fileName) => {
        setProgress({ current, total, fileName })
      })
      const allLrc = files.every((f) => f.name.endsWith('.lrc'))
      setMsg(allLrc
        ? (result.length > 0 ? `已匹配 ${result.length} 首歌词` : '未找到匹配的歌曲')
        : `成功导入 ${result.length} 首歌曲`)
      setTimeout(() => setMsg(''), 2500)
    } catch {
      setMsg('导入失败，请重试')
    } finally {
      setImporting(false)
      setProgress({ current: 0, total: 0, fileName: '' })
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".mp3,.m4a,.flac,.wav,.ogg,.lrc" multiple className="hidden" onChange={handleImport} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center justify-center w-9 h-9 rounded-full disabled:opacity-40 active:scale-95 transition-all"
        style={{
          background: importing ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(245,197,66,0.15), rgba(245,197,66,0.06))',
          border: '1px solid rgba(245,197,66,0.15)',
          color: importing ? '#9E9EA4' : '#F5C542',
        }}
      >
        {importing ? (
          <div className="w-4 h-4 border-2 border-white/10 border-t-gold-400 rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {/* 进度条 */}
      {importing && progress.total > 0 && (
        <div className="mt-2 w-48">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-muted truncate max-w-[140px]">{progress.fileName}</span>
            <span className="text-[10px] text-text-muted tabular-nums">{progress.current}/{progress.total}</span>
          </div>
          <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-400/60 rounded-full transition-all duration-200"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-gold-400/80 mt-2 animate-fade-in font-medium">{msg}</p>}
    </>
  )
}
