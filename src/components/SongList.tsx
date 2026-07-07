import { useState, useRef, useEffect, useCallback } from 'react'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlaylistStore } from '../stores/playlistStore'
import CoverImage from './CoverImage'
import { haptic } from '../utils/haptics'
import type { SongMeta } from '../types'

interface Props {
  songs: SongMeta[]
  showArtist?: boolean
  showAlbum?: boolean
  contextPlaylistId?: string
  onPlay: (songId: string, queue?: string[], index?: number) => void
}

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD = 10

export default function SongList({ songs, showArtist = true, showAlbum = false, contextPlaylistId, onPlay }: Props) {
  const { toggleFavorite, deleteSong } = useLibraryStore()
  const { playlists, addSong, removeSong } = usePlaylistStore()
  const [menuTarget, setMenuTarget] = useState<{ song: SongMeta; x: number; y: number } | null>(null)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 长按手势状态
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pressTarget = useRef<SongMeta | null>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  useEffect(() => {
    const handler = () => setMenuTarget(null)
    if (menuTarget) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [menuTarget])

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const openMenu = useCallback((song: SongMeta, x: number, y: number) => {
    const mx = Math.min(x, window.innerWidth - 180)
    const my = Math.min(y, window.innerHeight - 280)
    setMenuTarget({ song, x: mx, y: my })
    setShowPlaylistPicker(false)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent, song: SongMeta) => {
    // 只对 touch/pen 启用长按
    if (e.pointerType === 'mouse') return
    pressStartPos.current = { x: e.clientX, y: e.clientY }
    pressTarget.current = song
    longPressTimer.current = setTimeout(() => {
      haptic('heavy')
      openMenu(song, e.clientX, e.clientY)
    }, LONG_PRESS_MS)
  }, [openMenu])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressTimer.current) return
    const dx = Math.abs(e.clientX - pressStartPos.current.x)
    const dy = Math.abs(e.clientY - pressStartPos.current.y)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearLongPress()
    }
  }, [clearLongPress])

  const handlePointerUp = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const handleContextMenu = useCallback((e: React.MouseEvent, song: SongMeta) => {
    e.preventDefault()
    openMenu(song, e.clientX, e.clientY)
  }, [openMenu])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="stagger-list">
      {songs.map((song, index) => (
        <div
          key={song.id}
          className="song-row flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg mx-1 select-none"
          style={{ touchAction: 'manipulation' }}
          onClick={() => {
            haptic('light')
            onPlay(song.id, songs.map((s) => s.id), index)
          }}
          onContextMenu={(e) => handleContextMenu(e, song)}
          onPointerDown={(e) => handlePointerDown(e, song)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
            <CoverImage coverArt={song.coverArt} title={song.title} size="sm" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium truncate text-text-primary">{song.title}</p>
            <p className="text-[12px] text-text-secondary truncate mt-0.5">
              {showArtist && song.artist}
              {showArtist && showAlbum && song.album !== '未知专辑' && ` · ${song.album}`}
            </p>
          </div>

          <span className="text-[12px] text-text-muted tabular-nums flex-shrink-0 font-medium tracking-wide mr-1">
            {formatDuration(song.duration)}
          </span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 text-text-muted hover:text-gold-400 hover:bg-white/[0.04] transition-all"
            onClick={(e) => { e.stopPropagation(); handleContextMenu(e, song) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Context Menu — 移动端底部 sheet, 桌面端定位弹窗 */}
      {menuTarget && (
        <>
          {/* 移动端遮罩层 */}
          {isMobile && (
            <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm animate-fade-in"
              onClick={() => setMenuTarget(null)} />
          )}

          <div
            ref={menuRef}
            className={`fixed z-[60] glass rounded-2xl shadow-2xl shadow-black/60 animate-scale-in ring-1 ring-white/[0.04] ${
              isMobile
                ? 'left-4 right-4 bottom-4 rounded-[20px] animate-slide-up'
                : 'w-48 overflow-hidden'
            }`}
            style={isMobile ? undefined : { left: menuTarget.x, top: menuTarget.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 移动端拖拽指示条 */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-8 h-1 rounded-full bg-white/[0.12]" />
              </div>
            )}

            {/* 移动端显示歌曲信息 */}
            {isMobile && (
              <div className="px-5 py-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <CoverImage coverArt={menuTarget.song.coverArt} title={menuTarget.song.title} size="sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-text-primary truncate">{menuTarget.song.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{menuTarget.song.artist}</p>
                </div>
              </div>
            )}

            {/* 喜欢 / 取消喜欢 */}
            <button
              className="w-full text-left px-4 py-3.5 text-[13px] hover:bg-white/[0.03] transition-colors flex items-center gap-3 text-text-secondary"
              onClick={() => { toggleFavorite(menuTarget.song.id); setMenuTarget(null) }}
            >
              <svg viewBox="0 0 24 24" fill={menuTarget.song.isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2" className={`w-[18px] h-[18px] ${menuTarget.song.isFavorite ? 'text-gold-400' : 'text-text-muted'}`}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {menuTarget.song.isFavorite ? '取消喜欢' : '我喜欢的音乐'}
            </button>

            {contextPlaylistId ? (
              <button
                className="w-full text-left px-4 py-3.5 text-[13px] hover:bg-white/[0.03] transition-colors flex items-center gap-3 text-text-secondary border-t border-white/[0.04]"
                onClick={() => { removeSong(contextPlaylistId, menuTarget.song.id); setMenuTarget(null) }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-text-muted">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                从歌单移除
              </button>
            ) : (
              <div className="border-t border-white/[0.04]">
                <button
                  className="w-full text-left px-4 py-3.5 text-[13px] hover:bg-white/[0.03] transition-colors flex items-center gap-3 text-text-secondary"
                  onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-text-muted">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  添加到歌单
                </button>
                {showPlaylistPicker && (
                  <div className="border-t border-white/[0.04] max-h-40 overflow-y-auto bg-white/[0.01]">
                    {playlists.length === 0 ? (
                      <p className="px-5 py-4 text-[12px] text-text-muted">暂无歌单，去创建</p>
                    ) : (
                      playlists.map((pl) => {
                        const alreadyIn = pl.songIds.includes(menuTarget.song.id)
                        return (
                          <button key={pl.id}
                            className={`w-full text-left px-7 py-2.5 text-[12px] truncate transition-colors ${
                              alreadyIn ? 'text-gold-400/40 cursor-default' : 'text-text-secondary hover:bg-white/[0.03]'
                            }`}
                            disabled={alreadyIn}
                            onClick={() => { if (!alreadyIn) { addSong(pl.id, menuTarget.song.id); setMenuTarget(null) } }}>
                            {pl.name}{alreadyIn ? ' · 已在' : ''}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-white/[0.04]">
              <button
                className="w-full text-left px-4 py-3.5 text-[13px] hover:bg-white/[0.03] transition-colors flex items-center gap-3 text-red-400/70"
                onClick={() => {
                  if (confirm(`确定从曲库中删除「${menuTarget.song.title}」？`)) deleteSong(menuTarget.song.id)
                  setMenuTarget(null)
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
                  <polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                从曲库删除
              </button>
            </div>
          </div>
        </>
      )}

      {songs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm">暂无歌曲</p>
        </div>
      )}
    </div>
  )
}
