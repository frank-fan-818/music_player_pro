import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useLibraryStore } from '../stores/libraryStore'
import { useAudioStore } from '../stores/audioStore'
import SongList from '../components/SongList'
import ImportButton from '../components/ImportButton'

export default function ArtistDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { songs } = useLibraryStore()
  const { requestPlay } = useAudioStore()
  const artistName = decodeURIComponent(name || '')

  const artistSongs = useMemo(
    () => songs.filter((s) => s.artist.split(/\s*[/;&]\s*/).some((a) => a === artistName)),
    [songs, artistName]
  )

  // 用第一首歌的封面作为歌手头像
  const firstCover = artistSongs[0]?.coverArt || null

  return (
    <div className="pt-14 px-5 pb-4">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-gold-400 text-sm font-medium mb-4 hover:text-gold-300 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <polyline points="15,18 9,12 15,6" />
        </svg>
        返回
      </button>

      {/* 歌手头部 */}
      <div className="flex items-center gap-5 mb-6">
        <div className="w-[72px] h-[72px] rounded-full overflow-hidden flex-shrink-0 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]">
          {firstCover ? (
            <img src={firstCover} alt={artistName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full cover-placeholder flex items-center justify-center">
              <span className="text-3xl font-bold text-white/[0.06]">{artistName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">{artistName}</h1>
          <p className="text-sm text-text-muted mt-1">{artistSongs.length} 首歌曲</p>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => { if (artistSongs.length > 0) requestPlay(artistSongs[0].id, artistSongs.map((s) => s.id), 0) }}
          disabled={artistSongs.length === 0}
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 disabled:opacity-30 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)', boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2)' }}>
          播放全部
        </button>
        <ImportButton />
      </div>

      {/* 歌曲列表 */}
      {artistSongs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">该歌手暂无歌曲</p>
        </div>
      ) : (
        <SongList
          songs={artistSongs}
          showArtist={false}
          showAlbum
          onPlay={(songId) =>
            requestPlay(songId, artistSongs.map((s) => s.id), artistSongs.findIndex((s) => s.id === songId))
          }
        />
      )}
    </div>
  )
}
