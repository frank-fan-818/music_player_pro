import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { songService } from '../db/songService'
import { useAudioStore } from '../stores/audioStore'
import SongList from '../components/SongList'
import type { Song } from '../types'

export default function AlbumDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { requestPlay } = useAudioStore()
  const albumName = decodeURIComponent(name || '')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    songService.getByAlbum(albumName).then((s) => { setSongs(s); setLoading(false) })
  }, [albumName])

  const artistName = songs[0]?.artist || ''
  const coverArt = songs[0]?.coverArt || null

  if (loading) return <div className="pt-14 px-5"><div className="w-6 h-6 border-2 border-white/10 border-t-gold-400 rounded-full animate-spin mx-auto mt-20" /></div>

  return (
    <div className="pt-14 px-5 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gold-400 text-sm font-medium mb-4 hover:text-gold-300 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15,18 9,12 15,6" /></svg>
        返回
      </button>

      <div className="flex items-center gap-5 mb-6">
        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]">
          {coverArt ? (
            <img src={coverArt} alt={albumName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full cover-placeholder flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white/[0.04]"><circle cx="12" cy="12" r="10" /></svg>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary truncate">{albumName}</h1>
          {artistName && <p className="text-sm text-text-secondary mt-1">{artistName}</p>}
          <p className="text-sm text-text-muted mt-1">{songs.length} 首歌曲</p>
        </div>
      </div>

      <button
        onClick={() => { if (songs.length > 0) requestPlay(songs[0].id, songs.map((s) => s.id), 0) }}
        className="px-6 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 mb-6 active:scale-95 transition-all"
        style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)', boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2)' }}>
        播放全部
      </button>

      <SongList songs={songs} showArtist={false}
        onPlay={(songId) => requestPlay(songId, songs.map((s) => s.id), songs.findIndex((s) => s.id === songId))} />
    </div>
  )
}
