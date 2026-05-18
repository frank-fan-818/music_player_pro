import { useAudioStore } from '../stores/audioStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useNavigate } from 'react-router-dom'
import SongList from '../components/SongList'
import ImportButton from '../components/ImportButton'
import { useMemo, useState } from 'react'

export default function NowPlayingPage() {
  const { songs, recentIds, deleteSongs, toggleFavorite } = useLibraryStore()
  const { playlists, addSong } = usePlaylistStore()
  const { requestPlay, queue } = useAudioStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBatchPlaylistPicker, setShowBatchPlaylistPicker] = useState(false)

  const recentSongs = useMemo(
    () => recentIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as typeof songs,
    [recentIds, songs]
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`确定删除选中的 ${selected.size} 首歌曲？`)) return
    await deleteSongs([...selected])
    setSelected(new Set())
    setSelectMode(false)
  }

  // 搜索: 歌名/歌手/专辑包含关键字（大小写不敏感）
  const searchResults = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
    )
  }, [query, songs])

  return (
    <div className="pt-14 px-5 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary">现在就听</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/settings')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-text-muted hover:text-gold-400 hover:bg-white/[0.04] transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          {songs.length > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()) }}
              className="px-4 py-2 rounded-full text-sm font-semibold active:scale-95 transition-all"
              style={{
                background: selectMode ? 'rgba(245,197,66,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selectMode ? 'rgba(245,197,66,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: selectMode ? '#F5C542' : '#9E9EA4',
              }}
            >
              {selectMode ? '取消' : '选择'}
            </button>
          )}
          <ImportButton />
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索歌曲、歌手或专辑..."
          className="w-full bg-white/[0.04] rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary outline-none border border-white/[0.06] focus:border-gold-400/40 transition-colors placeholder:text-text-muted"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-white/[0.06] text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 存储概览 */}
      {songs.length > 0 && !query && (
        <div className="flex items-center gap-4 mb-5 text-[11px] text-text-muted">
          <span>{songs.length} 首歌曲</span>
          <span>{formatSize(songs.reduce((sum, s) => sum + s.fileSize, 0))}</span>
        </div>
      )}

      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-24 h-24 rounded-2xl cover-placeholder flex items-center justify-center mb-6 ring-1 ring-white/[0.03] shadow-2xl shadow-black/40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white/[0.04]">
              <path d="M9 18V5l12-2v13" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">曲库为空</h2>
          <p className="text-sm text-text-muted mb-8 max-w-xs leading-relaxed">
            点击「导入歌曲」添加你的 MP3 文件，音乐播放器会自动识别歌手和专辑信息
          </p>
          <ImportButton />
        </div>
      ) : query.trim() ? (
        /* 搜索结果 */
        <>
          <div className="mb-4">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em]">
              搜索结果 · {searchResults?.length ?? 0} 首
            </h2>
          </div>
          {searchResults && searchResults.length > 0 ? (
            <SongList
              songs={searchResults}
              onPlay={(songId) =>
                requestPlay(songId, searchResults.map((s) => s.id), searchResults.findIndex((s) => s.id === songId))
              }
            />
          ) : (
            <div className="text-center py-16">
              <p className="text-text-muted text-sm">未找到匹配的歌曲</p>
            </div>
          )}
        </>
      ) : (
        <>
          {queue.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-4">播放队列</h2>
              <SongList
                songs={queue.map((id) => songs.find((s) => s.id === id)!).filter(Boolean)}
                onPlay={(songId) => requestPlay(songId, queue, queue.findIndex((id) => id === songId))}
              />
            </div>
          )}

          {recentSongs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-4">最近播放</h2>
              <SongList
                songs={recentSongs}
                onPlay={(songId) =>
                  requestPlay(songId, recentSongs.map((s) => s.id), recentSongs.findIndex((s) => s.id === songId))
                }
              />
            </div>
          )}

          <div>
            {selectMode ? (
              /* 批量选择模式 */
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em]">
                    已选 {selected.size} / {songs.length} 首
                  </h2>
                  <button onClick={() => {
                    if (selected.size === songs.length) setSelected(new Set())
                    else setSelected(new Set(songs.map((s) => s.id)))
                  }}
                    className="text-[11px] text-gold-400 hover:text-gold-300 transition-colors font-medium">
                    {selected.size === songs.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="stagger-list">
                  {songs.map((song) => {
                    const checked = selected.has(song.id)
                    return (
                      <div key={song.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          checked ? 'bg-gold-400/5 ring-1 ring-gold-400/10' : 'hover:bg-white/[0.02]'
                        }`}
                        onClick={() => toggleSelect(song.id)}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked ? 'border-gold-400 bg-gold-400' : 'border-white/[0.10]'
                        }`}>
                          {checked && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-obsidian-900">
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                          )}
                        </div>
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
                          {song.coverArt ? (
                            <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full cover-placeholder flex items-center justify-center">
                              <span className="text-xs font-bold" style={{ color: `hsl(${hashHue(song.title)},50%,60%)` }}>{song.title.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium truncate text-text-primary">{song.title}</p>
                          <p className="text-[12px] text-text-secondary truncate mt-0.5">{song.artist}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-4">
                  全部歌曲 · {songs.length} 首
                </h2>
                <SongList
                  songs={songs}
                  onPlay={(songId) =>
                    requestPlay(songId, songs.map((s) => s.id), songs.findIndex((s) => s.id === songId))
                  }
                />
              </>
            )}
          </div>
        </>
      )}
      {/* 批量操作浮动栏 */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up-mini">
          {/* playlist picker */}
          {showBatchPlaylistPicker && (
            <div className="glass rounded-2xl mb-2 overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.04] max-h-44 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              {playlists.length === 0 ? (
                <p className="px-5 py-4 text-[12px] text-text-muted text-center">暂无歌单，先去创建</p>
              ) : (
                playlists.map((pl) => (
                  <button key={pl.id} className="w-full text-left px-5 py-3 text-[13px] text-text-secondary hover:bg-white/[0.03] transition-colors"
                    onClick={() => {
                      [...selected].forEach((id) => addSong(pl.id, id))
                      setShowBatchPlaylistPicker(false)
                      setSelected(new Set())
                      setSelectMode(false)
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 inline mr-2 text-text-muted">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {pl.name}
                  </button>
                ))
              )}
            </div>
          )}

          {/* action bar */}
          <div className="flex items-center gap-2 px-3 py-3 rounded-2xl shadow-2xl shadow-black/60"
            style={{ background: 'rgba(18,18,21,0.95)', backdropFilter: 'blur(24px)' }}>
            <span className="text-xs font-semibold text-text-secondary ml-1 mr-1">已选 {selected.size} 首</span>

            <div className="flex-1" />

            {/* 批量喜欢 */}
            <button onClick={async () => {
              for (const id of selected) await toggleFavorite(id)
              setSelected(new Set())
              setSelectMode(false)
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-gold-400 hover:bg-white/[0.04] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              喜欢
            </button>

            {/* 加入歌单 */}
            <button onClick={() => setShowBatchPlaylistPicker(!showBatchPlaylistPicker)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-gold-400 hover:bg-white/[0.04] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              歌单
            </button>

            {/* 批量删除 */}
            <button onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
