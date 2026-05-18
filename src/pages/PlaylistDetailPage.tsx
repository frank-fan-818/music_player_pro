import { useParams, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useAudioStore } from '../stores/audioStore'
import SongList from '../components/SongList'

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { playlists, deletePlaylist, updateMeta, addSong } = usePlaylistStore()
  const { songs } = useLibraryStore()
  const { requestPlay } = useAudioStore()

  const playlist = useMemo(() => playlists.find((p) => p.id === id), [playlists, id])
  const playlistSongs = useMemo(
    () => playlist?.songIds.map((sid) => songs.find((s) => s.id === sid)).filter(Boolean) as typeof songs ?? [],
    [playlist?.songIds, songs]
  )

  // playlist cover: first song's cover art
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  useEffect(() => {
    const first = playlistSongs[0]
   setCoverUrl(first?.coverArt || null)
  }, [playlistSongs])

  // rename state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  // song picker
  const [showPicker, setShowPicker] = useState(false)

  if (!playlist) {
    return <div className="pt-14 px-5 text-center"><p className="text-text-muted">歌单未找到</p></div>
  }

  const handleDelete = async () => {
    if (confirm(`确定删除歌单「${playlist.name}」？歌曲不会被删除。`)) {
      await deletePlaylist(playlist.id)
      navigate('/playlists', { replace: true })
    }
  }

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === playlist.name) { setEditing(false); return }
    await updateMeta(playlist.id, editName.trim())
    setEditing(false)
  }

  const playlistSongIds = playlist.songIds
  const notInPlaylist = songs.filter((s) => !playlistSongIds.includes(s.id))

  return (
    <div className="pt-14 px-5 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gold-400 text-sm font-medium mb-4 hover:text-gold-300 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15,18 9,12 15,6" /></svg>
        返回
      </button>

      <div className="flex items-center gap-5 mb-6">
        {/* playlist cover — uses first song's cover */}
        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]">
          {coverUrl ? (
            <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full cover-placeholder flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white/[0.04]"><path d="M9 18V5l12-2v13" /></svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                autoFocus className="flex-1 bg-white/[0.04] rounded-lg px-3 py-1.5 text-lg font-bold text-text-primary outline-none border border-gold-400/40"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false) }}
                onBlur={handleRename} />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-text-primary truncate" onDoubleClick={() => { setEditName(playlist.name); setEditing(true) }}>
              {playlist.name}
            </h1>
          )}
          {playlist.description && <p className="text-sm text-text-secondary mt-1">{playlist.description}</p>}
          <p className="text-sm text-text-muted mt-1">{playlistSongs.length} 首歌曲</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => { if (playlistSongs.length > 0) requestPlay(playlistSongs[0].id, playlistSongs.map((s) => s.id), 0) }}
          disabled={playlistSongs.length === 0}
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 disabled:opacity-30 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)', boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2)' }}>
          播放全部
        </button>
        <button onClick={() => { setEditName(playlist.name); setEditing(true) }}
          className="px-5 py-2.5 rounded-full border border-white/[0.06] text-sm font-medium text-text-secondary hover:border-gold-400/30 hover:text-gold-400 transition-all">
          重命名
        </button>
        <button
          onClick={() => setShowPicker(true)}
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)', boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2)' }}>
          添加歌曲
        </button>
        <button onClick={handleDelete}
          className="px-5 py-2.5 rounded-full border border-white/[0.06] text-sm font-medium text-text-muted hover:border-red-400/30 hover:text-red-400 transition-all">
          删除歌单
        </button>
      </div>

      <SongList
        songs={playlistSongs}
        contextPlaylistId={playlist.id}
        onPlay={(songId) => requestPlay(songId, playlistSongs.map((s) => s.id), playlistSongs.findIndex((s) => s.id === songId))}
      />

      {/* 添加歌曲弹窗 */}
      {showPicker && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-obsidian-900 animate-slide-up" onClick={(e) => e.stopPropagation()}>
          {/* header */}
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <button onClick={() => setShowPicker(false)} className="text-gold-400 text-sm font-medium">完成</button>
            <h2 className="text-lg font-bold text-text-primary">添加歌曲到歌单</h2>
            <div className="w-12" />
          </div>

          {/* song list with tap-to-add */}
          <div className="flex-1 overflow-y-auto px-3">
            {notInPlaylist.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-text-muted text-sm">曲库中没有更多歌曲了</p>
              </div>
            ) : (
              notInPlaylist.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-white/[0.02] active:bg-gold-400/5 transition-colors"
                  onClick={() => { addSong(playlist.id, song.id) }}
                >
                  <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
                    {song.coverArt ? (
                      <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full cover-placeholder flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/10"><path d="M9 18V5l12-2v13" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate text-text-primary">{song.title}</p>
                    <p className="text-[12px] text-text-secondary truncate mt-0.5">{song.artist}</p>
                  </div>
                  {/* add icon */}
                  <div className="w-8 h-8 rounded-full border border-gold-400/30 flex items-center justify-center flex-shrink-0 text-gold-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
