import { useState, useRef, useEffect, useMemo } from 'react'
import { useAudioStore } from '../stores/audioStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import Visualizer from './Visualizer'
import CoverImage from './CoverImage'
import { haptic } from '../utils/haptics'
import type { PlayMode, SongMeta } from '../types'

// --- module-level constants ---

const playModeLabel: Record<PlayMode, string> = {
  'sequential': '顺序播放', 'repeat-list': '列表循环', 'repeat-one': '单曲循环', 'shuffle': '随机播放',
}
const PLAY_MODE_ORDER: PlayMode[] = ['sequential', 'repeat-list', 'repeat-one', 'shuffle']

const MODE_ICON_CLS = "w-[18px] h-[18px]"

function PlayModeIcon({ mode }: { mode: PlayMode }) {
  if (mode === 'repeat-one') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={MODE_ICON_CLS}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <text x="11.5" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">1</text>
    </svg>
  )
  if (mode === 'repeat-list') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={MODE_ICON_CLS}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
  if (mode === 'shuffle') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={MODE_ICON_CLS}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={MODE_ICON_CLS}>
      <polygon points="5 3 19 12 5 21" />
    </svg>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface LRCLine {
  time: number
  text: string
}

/** 解析 LRC 歌词文本 → [{time: 秒, text: 歌词}] 按时间排序 */
function parseLRC(raw: string): LRCLine[] {
  const lines: LRCLine[] = []
  const re = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let match: RegExpExecArray | null
    const timestamps: number[] = []
    while ((match = re.exec(trimmed)) !== null) {
      const min = parseInt(match[1])
      const sec = parseInt(match[2])
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0
      timestamps.push(min * 60 + sec + ms / 1000)
    }
    re.lastIndex = 0
    const text = trimmed.replace(/\[[^\]]*\]/g, '').trim()
    if (text && timestamps.length > 0) {
      for (const t of timestamps) lines.push({ time: t, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

export default function FullPlayer({ isOpen, onClose }: Props) {
  const {
    currentSong, isPlaying, isLoading, currentTime, duration,
    volume, playMode, queue, queueIndex,
    requestToggle, requestNext, requestPrevious,
    seek, setVolume, setPlayMode, requestPlay,
  } = useAudioStore()
  const { songs, toggleFavorite, updateLyrics } = useLibraryStore()
  const visualizerEnabled = useSettingsStore((s) => s.visualizerEnabled)
  const [dragPos, setDragPos] = useState<number | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
  const [editingLyrics, setEditingLyrics] = useState(false)
  const [lyricsText, setLyricsText] = useState('')
  const [showQueue, setShowQueue] = useState(false)

  // 滑动 + 拖拽状态
  const [swipeX, setSwipeX] = useState(0)
  const [dismissY, setDismissY] = useState(0)
  const swipeRef = useRef({ startX: 0, startY: 0, active: false, horizontal: false })
  const DISMISS_THRESHOLD = 100
  const SWIPE_THRESHOLD = 60

  const draggingRef = useRef(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const lyricsScrollRef = useRef<HTMLDivElement>(null)
  const seekRef = useRef(seek); seekRef.current = seek
  const durationRef = useRef(duration); durationRef.current = duration

  // LRC 解析 + 当前行
  const lrcLines = useMemo(() => parseLRC(currentSong?.lyrics || ''), [currentSong?.lyrics])
  const activeLrcIndex = useMemo(() => {
    if (lrcLines.length === 0) return -1
    for (let i = lrcLines.length - 1; i >= 0; i--) {
      if (currentTime >= lrcLines[i].time) return i
    }
    return -1
  }, [lrcLines, currentTime])

  // 自动滚动到当前歌词行
  useEffect(() => {
    if (!showLyrics || activeLrcIndex < 0 || !lyricsScrollRef.current) return
    const el = lyricsScrollRef.current
    const line = el.children[activeLrcIndex] as HTMLElement | undefined
    if (line) {
      line.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLrcIndex, showLyrics])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const rect = progressRef.current?.getBoundingClientRect()
      if (!rect) return
      setDragPos(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
    }
    const onUp = (e: PointerEvent) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const rect = progressRef.current?.getBoundingClientRect()
      if (!rect) return
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setDragPos(null)
      if (durationRef.current > 0) seekRef.current(ratio * durationRef.current)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    draggingRef.current = true
    const rect = progressRef.current?.getBoundingClientRect()
    if (rect) setDragPos(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }

  // === 滑动切歌 (cover 区域水平滑动) ===
  const handleSwipeStart = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    swipeRef.current = { startX: e.clientX, startY: e.clientY, active: true, horizontal: false }
  }
  const handleSwipeMove = (e: React.PointerEvent) => {
    if (!swipeRef.current.active) return
    const dx = e.clientX - swipeRef.current.startX
    const dy = e.clientY - swipeRef.current.startY
    if (!swipeRef.current.horizontal && Math.abs(dx) > 10) {
      swipeRef.current.horizontal = true
    }
    if (swipeRef.current.horizontal && Math.abs(dx) > Math.abs(dy)) {
      setSwipeX(dx)
    }
  }
  const handleSwipeEnd = () => {
    if (!swipeRef.current.active) return
    swipeRef.current.active = false
    if (swipeRef.current.horizontal && Math.abs(swipeX) > SWIPE_THRESHOLD) {
      haptic('light')
      if (swipeX < 0) requestNext()
      else requestPrevious()
    }
    setSwipeX(0)
  }

  // === 拖拽关闭 (header 区域垂直下拉) ===
  const handleDismissStart = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    swipeRef.current = { startX: e.clientX, startY: e.clientY, active: true, horizontal: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleDismissMove = (e: React.PointerEvent) => {
    if (!swipeRef.current.active) return
    const dy = e.clientY - swipeRef.current.startY
    if (dy > 0) setDismissY(dy)
  }
  const handleDismissEnd = (e: React.PointerEvent) => {
    if (!swipeRef.current.active) return
    swipeRef.current.active = false
    if (dismissY > DISMISS_THRESHOLD) {
      haptic('medium')
      onClose()
    }
    setDismissY(0)
  }

  // O(1) 歌曲查找 Map — 避免队列渲染时每次 O(N*M) find (Efficiency #1 fix)
  const songsMap = useMemo(() => {
    const m = new Map<string, SongMeta>()
    for (const s of songs) m.set(s.id, s)
    return m
  }, [songs])

  if (!isOpen || !currentSong) return null

  const displayProgress = dragPos !== null ? dragPos * 100 : duration > 0 ? (currentTime / duration) * 100 : 0

  const fmt = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isFav = currentSong.isFavorite

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-slide-up overflow-hidden" style={{ background: '#08080A' }}>
      {/* ambient glow behind cover — pulses with a warm golden breath */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[80vw] h-[40vh] rounded-full bg-gold-400/5 animate-pulse-glow pointer-events-none"
        style={{ filter: 'blur(80px)' }}
      />

      {/* glass overlay for depth */}
      <div className="absolute inset-0 bg-obsidian-900/70 backdrop-blur-heavy pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* header — minimal; drag down to dismiss */}
        <div
          className="flex items-center justify-between px-6 pt-6 safe-top"
          onPointerDown={handleDismissStart}
          onPointerMove={handleDismissMove}
          onPointerUp={handleDismissEnd}
          onPointerCancel={handleDismissEnd}
          style={{ transform: `translateY(${dismissY}px)`, transition: dismissY === 0 ? 'transform 0.3s ease' : 'none' }}
        >
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-text-secondary">
              <polyline points="16,4 8,12 16,20" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">正在播放</span>
          <div className="flex items-center gap-1">
            {/* 播放列表 */}
            {queue.length > 1 && (
              <button
                onClick={() => setShowQueue(true)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                  showQueue ? 'bg-gold-400/10 text-gold-400' : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08]'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            )}
            <button
              onClick={() => toggleFavorite(currentSong.id)}
              className={`w-10 h-10 flex items-center justify-center rounded-full ${isFav ? 'bg-gold-400/10' : 'bg-white/[0.04]'} hover:bg-white/[0.08] transition-colors`}
            >
              <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor"
                strokeWidth="2" className={`w-5 h-5 ${isFav ? 'text-gold-400' : 'text-text-secondary'}`}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </div>

        {/* cover / lyrics / visualizer — swipe to skip, tap to toggle lyrics */}
        <div
          className="flex-1 flex items-center justify-center px-6 py-4 select-none"
          style={{ touchAction: 'pan-y', transform: `translateX(${swipeX}px)` }}
          onClick={() => setShowLyrics(!showLyrics)}
          onPointerDown={handleSwipeStart}
          onPointerMove={handleSwipeMove}
          onPointerUp={handleSwipeEnd}
          onPointerCancel={handleSwipeEnd}
        >
          {visualizerEnabled && isPlaying && !showLyrics ? (
            /* 可视化频谱 */
            <div className="w-full max-w-[320px] aspect-square flex items-center justify-center">
              <Visualizer />
            </div>
          ) : showLyrics && (currentSong.lyrics || editingLyrics) ? (
            /* lyrics view */
            <div className="w-full max-w-[320px] h-full max-h-[320px] flex flex-col rounded-2xl bg-obsidian-800/60 backdrop-blur-md animate-fade-in overflow-hidden">
              {editingLyrics ? (
                <textarea
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-[13px] text-text-primary leading-7 p-5 outline-none resize-none placeholder:text-text-muted"
                  placeholder="粘贴歌词..."
                />
              ) : lrcLines.length > 0 ? (
                /* 滚动 LRC 歌词 */
                <div ref={lyricsScrollRef} className="flex-1 overflow-y-auto py-12 px-5 scroll-smooth">
                  {/* 顶部占位，让首行也能滚到中间 */}
                  <div className="h-[40%]" />
                  {lrcLines.map((line, i) => {
                    const isActive = i === activeLrcIndex
                    const isNear = Math.abs(i - activeLrcIndex) <= 1
                    return (
                      <div
                        key={i}
                        className={`text-center py-2 transition-all duration-500 ${
                          isActive
                            ? 'text-gold-400 text-[18px] font-bold scale-105'
                            : isNear
                              ? 'text-text-secondary text-[14px]'
                              : 'text-text-muted text-[13px] opacity-50'
                        }`}
                      >
                        {line.text}
                      </div>
                    )
                  })}
                  {/* 底部占位 */}
                  <div className="h-[40%]" />
                </div>
              ) : (
                /* 纯文本歌词 (无 LRC 时间戳) */
                <div className="flex-1 overflow-y-auto py-6 px-5">
                  <div className="text-[13px] text-text-secondary leading-7 whitespace-pre-line text-center font-medium tracking-wide">
                    {currentSong.lyrics}
                  </div>
                </div>
              )}
              {/* edit bar */}
              <div className="flex justify-end gap-2 px-4 py-2 border-t border-white/[0.04]">
                {editingLyrics ? (
                  <>
                    <button onClick={() => setEditingLyrics(false)}
                      className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">取消</button>
                    <button onClick={async () => {
                      await updateLyrics(currentSong.id, lyricsText)
                      setEditingLyrics(false)
                    }}
                      className="px-4 py-1.5 text-xs font-semibold text-obsidian-900 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)' }}>保存</button>
                  </>
                ) : (
                  <button onClick={() => { setLyricsText(currentSong.lyrics || ''); setEditingLyrics(true) }}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-gold-400 transition-colors">
                    编辑歌词
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* cover view */
            <div className={`relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.04] ${currentSong.lyrics ? 'cursor-pointer' : ''}`}>
              {currentSong.coverArt ? (
                <img src={currentSong.coverArt} alt={currentSong.title} className="w-full h-full object-cover animate-breathe" />
              ) : (
                <div className="w-full h-full cover-placeholder flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-white/[0.04]"><path d="M9 18V5l12-2v13" /></svg>
                </div>
              )}
              {/* lyrics indicator */}
              <div className="absolute bottom-3 right-3 bg-obsidian-900/80 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] text-text-muted font-medium">
                {currentSong.lyrics ? '歌词' : '无歌词'}
              </div>
            </div>
          )}
        </div>

        {/* song info with golden accent divider */}
        <div className="px-8 mb-3">
          <div className="flex items-center justify-between mb-0.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-bold tracking-tight text-text-primary truncate">{currentSong.title}</h2>
              <p className="text-sm text-text-secondary mt-0.5 tracking-wide">
                {currentSong.artist}{currentSong.album !== '未知专辑' ? ` · ${currentSong.album}` : ''}
              </p>
            </div>
          </div>
          {/* subtle golden accent line */}
          <div className="w-6 h-0.5 bg-gold-400/40 rounded-full mt-2" />
        </div>

        {/* progress bar */}
        <div className="px-8 mb-3">
          <div
            ref={progressRef}
            className="relative h-8 -my-2 py-2 cursor-pointer group"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
          >
            <div className="relative h-1 bg-white/[0.06] rounded-full pointer-events-none overflow-visible">
              <div className="absolute inset-y-0 left-0 bg-gold-400/80 rounded-full" style={{ width: `${displayProgress}%` }} />
              {/* glowing knob */}
              <div
                className={`absolute top-1/2 w-3.5 h-3.5 rounded-full ${dragPos === null ? 'transition-all duration-200' : ''}`}
                style={{
                  left: `${displayProgress}%`,
                  transform: `translate(-50%, -50%)`,
                  background: dragPos !== null ? '#F5C542' : 'transparent',
                  boxShadow: dragPos !== null ? '0 0 12px rgba(245, 197, 66, 0.5)' : 'none',
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-2 pointer-events-none">
            <span className="text-xs text-text-muted tabular-nums font-medium tracking-wide">
              {dragPos !== null ? fmt(dragPos * duration) : fmt(currentTime)}
            </span>
            <span className="text-xs text-text-muted tabular-nums font-medium tracking-wide">{fmt(duration)}</span>
          </div>
        </div>

        {/* 播放列表 Overlay */}
        {showQueue && queue.length > 1 && (
          <div className="absolute inset-0 z-20 flex flex-col bg-obsidian-900/95 backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between px-6 pt-6 safe-top pb-3">
              <h3 className="text-base font-bold text-text-primary">播放列表</h3>
              <button
                onClick={() => setShowQueue(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-text-secondary">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 px-6 pb-3">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.15em]">
                {playModeLabel[playMode]} · {queue.length} 首
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-6 safe-bottom">
              {queue.map((sid, i) => {
                const song = songsMap.get(sid)
                if (!song) return null
                const isCurrent = i === queueIndex
                return (
                  <div key={sid}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-gold-400/[0.08] ring-1 ring-gold-400/15'
                        : 'hover:bg-white/[0.02] active:bg-white/[0.04]'
                    }`}
                    onClick={() => { requestPlay(sid, queue, i); setShowQueue(false) }}
                  >
                    <span className={`text-[11px] w-5 text-right tabular-nums font-medium flex-shrink-0 ${
                      isCurrent ? 'text-gold-400' : 'text-text-muted'
                    }`}>
                      {isCurrent ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 mx-auto">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (i + 1)}
                    </span>

                    <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                      <CoverImage coverArt={song.coverArt} title={song.title} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${isCurrent ? 'text-gold-400' : 'text-text-primary'}`}>
                        {song.title}
                      </p>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">{song.artist}</p>
                    </div>

                    {isCurrent && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className="w-[2px] bg-gold-400 rounded-full animate-breathe"
                            style={{ height: `${8 + j * 4}px`, animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* controls */}
        <div className="flex items-center justify-center gap-6 px-8 mb-3">
          {/* play mode — with hover tooltip */}
          <div className="relative group">
            <button onClick={() => {
              haptic('selection')
              setPlayMode(PLAY_MODE_ORDER[(PLAY_MODE_ORDER.indexOf(playMode) + 1) % PLAY_MODE_ORDER.length])
            }} className="w-9 h-9 flex items-center justify-center text-text-muted group-hover:text-gold-400 transition-colors">
              <PlayModeIcon mode={playMode} />
            </button>
            {/* tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-lg bg-obsidian-700/95 backdrop-blur-md ring-1 ring-white/[0.06] text-[10px] font-medium text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl">
              {playModeLabel[playMode]}
            </div>
          </div>

          {/* prev */}
          <button onClick={() => { haptic('light'); requestPrevious() }} className="w-10 h-10 flex items-center justify-center text-text-primary hover:text-gold-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
              <polygon points="7,4 18,12 7,20" transform="scale(-1,1) translate(-24,0)" />
              <line x1="4" y1="5" x2="4" y2="19" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </button>

          {/* play/pause — gold ring with glow */}
          <button
            onClick={() => { haptic('medium'); requestToggle() }}
            className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              background: 'linear-gradient(145deg, #F5C542, #D4A020)',
              boxShadow: '0 8px 32px rgba(245, 197, 66, 0.25), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {isLoading ? (
              <div className="w-[22px] h-[22px] border-[2.5px] border-black/20 border-t-black rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" fill="#0A0A0D" className="w-[22px] h-[22px]">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="#0A0A0D" className="w-[22px] h-[22px] ml-1">
                <polygon points="7,3 20,12 7,21" />
              </svg>
            )}
          </button>

          {/* next */}
          <button onClick={() => { haptic('light'); requestNext() }} className="w-10 h-10 flex items-center justify-center text-text-primary hover:text-gold-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
              <polygon points="7,4 18,12 7,20" />
              <line x1="20" y1="5" x2="20" y2="19" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </button>
        </div>

        {/* volume */}
        <div className="flex items-center gap-3 px-8 mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] text-text-muted flex-shrink-0">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
            {volume > 0.4 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2" />}
          </svg>
          <input type="range" min="0" max="1" step="0.01" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400
              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(245,197,66,0.5)] [&::-webkit-slider-thumb]:cursor-grab"
          />
          <span className="text-xs text-text-muted tabular-nums w-8 text-right font-medium">
            {Math.round(volume * 100)}
          </span>
        </div>

      </div>
    </div>
  )
}
