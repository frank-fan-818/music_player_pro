import { useMemo } from 'react'
import { useLibraryStore } from '../stores/libraryStore'
import { useAudioStore } from '../stores/audioStore'
import SongList from '../components/SongList'

export default function FavoritesPage() {
  const { songs } = useLibraryStore()
  const { requestPlay } = useAudioStore()
  const favSongs = useMemo(() => songs.filter((s) => s.isFavorite), [songs])

  return (
    <div className="pt-14 px-5 pb-4">
      <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary mb-6">收藏</h1>
      {favSongs.length === 0 ? (
        <div className="text-center py-28">
          <div className="w-24 h-24 rounded-2xl cover-placeholder flex items-center justify-center mx-auto mb-6 ring-1 ring-white/[0.03] shadow-2xl shadow-black/40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white/[0.04]">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">暂无收藏</h2>
          <p className="text-sm text-text-muted">长按歌曲，将其添加到收藏</p>
        </div>
      ) : (
        <>
          <button
            onClick={() => requestPlay(favSongs[0].id, favSongs.map((s) => s.id), 0)}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-obsidian-900 mb-6 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)', boxShadow: '0 4px 16px rgba(245, 197, 66, 0.2)' }}>
            播放全部
          </button>
          <SongList songs={favSongs} onPlay={(songId) =>
            requestPlay(songId, favSongs.map((s) => s.id), favSongs.findIndex((s) => s.id === songId))} />
        </>
      )}
    </div>
  )
}
