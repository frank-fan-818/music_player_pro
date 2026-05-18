import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaylistStore } from '../stores/playlistStore'
import { useLibraryStore } from '../stores/libraryStore'

export default function PlaylistsPage() {
  const { playlists, createPlaylist } = usePlaylistStore()
  const { songs } = useLibraryStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setShowCreate(false)
    const pl = await createPlaylist(name.trim())
    setName('')
    navigate(`/playlists/${pl.id}`)
  }

  // playlist cover URL cache: map playlistId → first song's cover blob URL
  const [coverMap, setCoverMap] = useState<Record<string, string>>({})
  useEffect(() => {
    const map: Record<string, string> = {}
    for (const pl of playlists) {
      const firstId = pl.songIds[0]
      if (!firstId) continue
      const song = songs.find((s) => s.id === firstId)
      if (song?.coverArt) {
        map[pl.id] = song.coverArt
      }
    }
    setCoverMap(map)
  }, [playlists, songs])

  return (
    <div className="pt-14 px-5 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary">歌单</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 active:scale-95 transition-all"
          style={{
            background: 'linear-gradient(135deg, #F5C542, #D4A020)',
            boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          新建歌单
        </button>
      </div>

      {/* create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="glass rounded-2xl p-6 w-72 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">新建歌单</h3>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="歌单名称" autoFocus
              className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-sm text-text-primary outline-none border border-white/[0.06] focus:border-gold-400/40 transition-colors placeholder:text-text-muted"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            <div className="flex gap-2.5 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 text-sm text-text-secondary bg-white/[0.04] rounded-xl hover:bg-white/[0.06] transition-colors font-medium">取消</button>
              <button onClick={handleCreate} disabled={!name.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-obsidian-900 rounded-xl disabled:opacity-30 transition-all"
                style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)' }}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="text-center py-28">
          <div className="w-24 h-24 rounded-2xl cover-placeholder flex items-center justify-center mx-auto mb-6 ring-1 ring-white/[0.03] shadow-2xl shadow-black/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-12 h-12 text-white/[0.04]" strokeWidth="1.2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </div>
          <p className="text-xl font-bold text-text-primary mb-2">暂无歌单</p>
          <p className="text-sm text-text-muted">创建你的第一个歌单，开始整理音乐</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 stagger-list">
          {playlists.map((pl) => (
            <div key={pl.id} className="card-press cursor-pointer group" onClick={() => navigate(`/playlists/${pl.id}`)}>
              <div className="aspect-square rounded-2xl overflow-hidden flex items-center justify-center mb-3 ring-1 ring-white/[0.03] shadow-xl shadow-black/40 group-active:ring-gold-400/20 transition-all">
                {coverMap[pl.id] ? (
                  <img src={coverMap[pl.id]} alt={pl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full cover-placeholder flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/[0.04] group-hover:text-white/[0.06] transition-colors">
                      <path d="M9 18V5l12-2v13" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-[13px] font-semibold truncate text-text-primary">{pl.name}</h3>
              <p className="text-[11px] text-text-muted mt-0.5">{pl.songIds.length} 首歌曲</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
