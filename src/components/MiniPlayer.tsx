import { useAudioStore } from '../stores/audioStore'
import { haptic } from '../utils/haptics'

interface Props {
  onExpand: () => void
}

export default function MiniPlayer({ onExpand }: Props) {
  const { currentSong, isPlaying, isLoading, currentTime, duration, requestToggle, requestNext } = useAudioStore()

  if (!currentSong) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="glass px-3 pt-2 pb-1.5 cursor-pointer animate-slide-up-mini"
      onClick={onExpand}
    >
      {/* micro progress bar */}
      <div className="h-0.5 mb-2 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full bg-gold-400/60 rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* cover — slightly larger, softer radius */}
        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 shadow-xl shadow-black/40 ring-1 ring-white/[0.04]">
          {currentSong.coverArt ? (
            <img src={currentSong.coverArt} alt={currentSong.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full cover-placeholder flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/[0.06]">
                <path d="M9 18V5l12-2v13" />
              </svg>
            </div>
          )}
        </div>

        {/* song info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate text-text-primary">{currentSong.title}</p>
          <p className="text-[11px] truncate text-text-muted mt-0.5">{currentSong.artist}</p>
        </div>

        {/* controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); haptic('light'); requestToggle() }}
            className="w-9 h-9 flex items-center justify-center text-gold-400 hover:text-gold-300 transition-colors"
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-white/10 border-t-gold-400 rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] ml-0.5">
                <polygon points="7,3 20,12 7,21" />
              </svg>
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); haptic('light'); requestNext() }}
            className="w-9 h-9 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
            aria-label="下一曲"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[16px] h-[16px]">
              <polygon points="7,4 18,12 7,20" />
              <line x1="20" y1="5" x2="20" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
