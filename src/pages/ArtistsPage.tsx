import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../stores/libraryStore'
import { useAudioStore } from '../stores/audioStore'

export default function ArtistsPage() {
  const { artists, songs } = useLibraryStore()
  const { requestPlay } = useAudioStore()
  const navigate = useNavigate()

  const sorted = [...artists].sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  // coverArt 现在为 base64 字符串，直接用即可，无需 URL 缓存

  return (
    <div className="pt-14 px-5 pb-4">
      <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary mb-6">歌手</h1>
      {sorted.length === 0 ? (
        <div className="text-center py-28">
          <div className="w-24 h-24 rounded-full cover-placeholder flex items-center justify-center mx-auto mb-6 ring-1 ring-white/[0.03] shadow-2xl shadow-black/40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white/[0.04]"><circle cx="12" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /></svg>
          </div>
          <p className="text-xl font-bold text-text-primary mb-2">暂无歌手</p>
          <p className="text-sm text-text-muted">导入歌曲后会自动按歌手分类</p>
        </div>
      ) : (
        <div className="stagger-list">
          {sorted.map((artist) => (
            <div key={artist.name}
              className="flex items-center gap-4 py-3.5 px-2 rounded-xl hover:bg-white/[0.02] cursor-pointer active:scale-[0.98] transition-all group"
              onClick={() => {
                const artistSongs = songs.filter((s) => s.artist.split(/\s*[/;&]\s*/).some((a) => a === artist.name))
                if (artistSongs.length > 0) requestPlay(artistSongs[0].id, artistSongs.map((s) => s.id), 0)
                navigate(`/artists/${encodeURIComponent(artist.name)}`)
              }}>
              <div className="w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 shadow-xl shadow-black/40 ring-1 ring-white/[0.04]">
                {artist.coverArt ? (
                  <img src={artist.coverArt} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full cover-placeholder flex items-center justify-center">
                    <span className="text-xl font-bold text-white/[0.06]">{artist.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-text-primary">{artist.name}</h3>
                <p className="text-sm text-text-muted mt-0.5">{artist.songCount} 首歌曲</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-text-muted group-hover:text-gold-400 transition-colors flex-shrink-0"><polyline points="9,18 15,12 9,6" /></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
