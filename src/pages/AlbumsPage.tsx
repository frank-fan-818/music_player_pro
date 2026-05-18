import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../stores/libraryStore'

export default function AlbumsPage() {
  const { albums } = useLibraryStore()
  const navigate = useNavigate()

  const sorted = [...albums].sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  return (
    <div className="pt-14 px-5 pb-4">
      <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary mb-6">专辑</h1>
      {sorted.length === 0 ? (
        <div className="text-center py-28">
          <div className="w-24 h-24 rounded-2xl cover-placeholder flex items-center justify-center mx-auto mb-6 ring-1 ring-white/[0.03] shadow-2xl shadow-black/40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white/[0.04]"><circle cx="12" cy="12" r="10" /></svg>
          </div>
          <p className="text-xl font-bold text-text-primary mb-2">暂无专辑</p>
          <p className="text-sm text-text-muted">导入歌曲后会自动按专辑分类</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 stagger-list">
          {sorted.map((album) => (
            <div key={album.name}
              className="card-press cursor-pointer group"
              onClick={() => navigate(`/albums/${encodeURIComponent(album.name)}`)}>
              <div className="aspect-square rounded-2xl overflow-hidden flex items-center justify-center mb-3 ring-1 ring-white/[0.03] shadow-xl shadow-black/40 group-active:ring-gold-400/20 transition-all">
                {album.coverArt ? (
                  <img src={album.coverArt} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full cover-placeholder flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/[0.04] group-hover:text-white/[0.06] transition-colors"><circle cx="12" cy="12" r="10" /></svg>
                  </div>
                )}
              </div>
              <h3 className="text-[13px] font-semibold truncate text-text-primary">{album.name}</h3>
              <p className="text-[11px] text-text-muted mt-0.5 truncate">{album.artist}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
