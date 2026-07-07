/**
 * Media Session API 集成
 *
 * 负责:
 *   - 锁屏/通知栏显示歌曲信息 (metadata)
 *   - 响应系统媒体控制 (播放/暂停/切歌/快进/快退)
 *   - 更新播放位置 (Elapsed Time API → 锁屏进度条)
 *
 * 架构: 独立模块, 订阅 audioStore 变化后写入 navigator.mediaSession
 */
import { useAudioStore } from '../stores/audioStore'
import { useLibraryStore } from '../stores/libraryStore'
import { dataUrlToBlobUrl } from '../utils/dataUrl'

let initialized = false

/** 初始化 Media Session — 在 Layout 挂载时调用一次 */
export function initMediaSession(): void {
  if (initialized) return
  if (!('mediaSession' in navigator)) return
  initialized = true

  const audioStore = useAudioStore
  const libraryStore = useLibraryStore

  // 设置 action handlers (仅一次)
  navigator.mediaSession.setActionHandler('play', () => {
    audioStore.getState().requestToggle()
  })
  navigator.mediaSession.setActionHandler('pause', () => {
    audioStore.getState().requestToggle()
  })
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    audioStore.getState().requestPrevious()
  })
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    audioStore.getState().requestNext()
  })
  navigator.mediaSession.setActionHandler('seekforward', () => {
    const { currentTime, duration } = audioStore.getState()
    audioStore.getState().seek(Math.min(currentTime + 10, duration))
  })
  navigator.mediaSession.setActionHandler('seekbackward', () => {
    const { currentTime } = audioStore.getState()
    audioStore.getState().seek(Math.max(currentTime - 10, 0))
  })
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        audioStore.getState().seek(details.seekTime)
      }
    })
  } catch { /* seekto not supported in all browsers */ }

  // 订阅 store 变化 → 更新 metadata 和 playbackState
  audioStore.subscribe((state, prev) => {
    const { currentSong, isPlaying, currentTime, duration } = state

    // 歌曲变化 → 更新 metadata
    if (currentSong?.id !== prev.currentSong?.id) {
      if (currentSong) {
        let artwork: MediaImage[] = []
        if (currentSong.coverArt) {
          const url = dataUrlToBlobUrl(currentSong.coverArt, currentSong.id)
          if (url) {
            artwork = [{ src: url, sizes: '512x512', type: 'image/jpeg' }]
          }
        }
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album !== '未知专辑' ? currentSong.album : '',
          artwork,
        })
      } else {
        navigator.mediaSession.metadata = null
      }
    }

    // 播放状态变化
    if (isPlaying !== prev.isPlaying) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }

    // 位置更新 (Elapsed Time → 锁屏进度条)
    if (currentTime !== prev.currentTime || duration !== prev.duration) {
      if (isPlaying && duration > 0 && navigator.mediaSession.setPositionState) {
        try {
          navigator.mediaSession.setPositionState({
            duration,
            playbackRate: 1,
            position: currentTime,
          })
        } catch { /* setPositionState may fail */ }
      }
    }
  })
}
