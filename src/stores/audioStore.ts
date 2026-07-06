/**
 * 播放器状态 Store (v4.1)
 *
 * 控制流程: play → load → engine.play → onTrackEnd → next/stop
 * 自动连播: 顺序/循环/随机/单曲循环
 *
 * v4.1 修复:
 *   - C1: 实现 shuffle 随机播放逻辑
 *   - H4: onTrackEnd 中 loadAndPlay 添加 try-catch, 防止卡死在 loading 状态
 */
import { create } from 'zustand'
import { audioEngine } from '../engine/audioEngine'
import { songService } from '../db/songService'
import type { Song, PlayMode } from '../types'

interface AudioStore {
  // 状态
  isPlaying: boolean
  isLoading: boolean
  loadingPhase: string
  currentSong: Song | null
  currentTime: number
  duration: number
  volume: number
  playMode: PlayMode
  queue: string[] // songIds
  queueIndex: number

  // 操作
  requestPlay: (songId: string, queue?: string[], startIndex?: number) => Promise<void>
  requestToggle: () => void
  requestNext: () => void
  requestPrevious: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  setPlayMode: (mode: PlayMode) => void
  addToQueue: (songId: string) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
}

/** Fisher-Yates 洗牌, 返回新数组 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const useAudioStore = create<AudioStore>((set, get) => {
  // 引擎事件绑定 (只绑定一次)
  let engineBound = false
  // v4.1: shuffle 专用的随机队列 (独立于原始 queue)
  let shuffledQueue: string[] = []
  let shuffledIndex = 0

  function bindEngine() {
    if (engineBound) return
    engineBound = true

    audioEngine.setListener({
      onStateChange(state) {
        set({ isPlaying: state === 'playing', isLoading: state === 'loading' })
      },
      onTimeUpdate(currentTime, duration) {
        set({ currentTime, duration })
      },
      async onTrackEnd() {
        const { playMode, queue, queueIndex } = get()

        // C1 fix: shuffle 模式使用随机队列
        if (playMode === 'shuffle') {
          shuffledIndex++
          if (shuffledIndex >= shuffledQueue.length) {
            // 随机队列播完 → 重新洗牌
            shuffledQueue = shuffleArray(queue)
            shuffledIndex = 0
          }
          const nextId = shuffledQueue[shuffledIndex]
          await loadAndPlay(nextId, queue.indexOf(nextId))
          return
        }

        if (playMode === 'repeat-one') {
          audioEngine.seek(0)
          await audioEngine.play(get().volume)
        } else if (queueIndex < queue.length - 1) {
          const nextIdx = queueIndex + 1
          await loadAndPlay(queue[nextIdx], nextIdx)
        } else if (playMode === 'repeat-list' && queue.length > 0) {
          await loadAndPlay(queue[0], 0)
        }
      },
      onError(error) {
        console.error('[AudioEngine]', error)
        set({ isLoading: false })
      },
      onLoadingProgress(phase) {
        set({ loadingPhase: phase })
      },
    })
  }

  // H4 fix: loadAndPlay 带错误处理, 加载失败自动跳过到下一首
  async function loadAndPlay(id: string, idx: number) {
    try {
      const song = await songService.getById(id)
      if (!song) throw new Error('Song not found')
      set({ queueIndex: idx, currentSong: song })
      await audioEngine.load(id)
      await audioEngine.play(get().volume)
    } catch (e: any) {
      console.error('[AudioStore] loadAndPlay failed:', e.message)
      set({ isLoading: false })
      // 加载失败 → 尝试自动跳到下一首 (不卡死在 loading)
      const { playMode, queue, queueIndex } = get()
      const nextIdx = queueIndex + 1
      if (nextIdx < queue.length) {
        loadAndPlay(queue[nextIdx], nextIdx)
      }
    }
  }

  bindEngine()

  return {
    isPlaying: false,
    isLoading: false,
    loadingPhase: '',
    currentSong: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    playMode: 'sequential',
    queue: [],
    queueIndex: -1,

    async requestPlay(songId, queue, startIndex) {
      bindEngine()
      const song = await songService.getById(songId)
      if (!song) return
      set({ currentSong: song, isLoading: true })
      if (queue) {
        set({ queue, queueIndex: startIndex ?? queue.indexOf(songId) })
        // C1 fix: shuffle 模式初始化随机队列
        if (get().playMode === 'shuffle') {
          shuffledQueue = shuffleArray(queue)
          shuffledIndex = shuffledQueue.indexOf(songId)
          if (shuffledIndex < 0) shuffledIndex = 0
        }
      }
      try {
        await audioEngine.load(songId)
        await audioEngine.play(get().volume)
      } catch {
        set({ isLoading: false })
      }
    },

    requestToggle() {
      const state = audioEngine.getState()
      if (state === 'playing') {
        audioEngine.pause()
      } else if (state === 'paused') {
        audioEngine.resume()
      }
    },

    requestNext() {
      const { queue, queueIndex, playMode } = get()

      // C1 fix: shuffle 模式
      if (playMode === 'shuffle') {
        shuffledIndex++
        if (shuffledIndex >= shuffledQueue.length) {
          shuffledQueue = shuffleArray(queue)
          shuffledIndex = 0
        }
        const nextId = shuffledQueue[shuffledIndex]
        get().requestPlay(nextId, queue, queue.indexOf(nextId))
        return
      }

      let nextIdx = queueIndex + 1
      if (nextIdx >= queue.length) {
        nextIdx = playMode === 'repeat-list' ? 0 : -1
      }
      if (nextIdx >= 0 && nextIdx < queue.length) {
        get().requestPlay(queue[nextIdx], queue, nextIdx)
      }
    },

    requestPrevious() {
      const { queue, queueIndex, playMode } = get()
      if (get().currentTime > 3) {
        audioEngine.seek(0)
        return
      }

      // C1 fix: shuffle 模式下回到随机队列中的上一首
      if (playMode === 'shuffle') {
        shuffledIndex = Math.max(0, shuffledIndex - 1)
        const prevId = shuffledQueue[shuffledIndex]
        get().requestPlay(prevId, queue, queue.indexOf(prevId))
        return
      }

      const prevIdx = queueIndex - 1
      if (prevIdx >= 0) {
        get().requestPlay(queue[prevIdx], queue, prevIdx)
      }
    },

    async seek(time) {
      await audioEngine.seek(time)
    },

    setVolume(v) {
      audioEngine.setVolume(v)
      set({ volume: v })
    },

    setPlayMode(mode) {
      const prev = get().playMode
      set({ playMode: mode })
      // C1 fix: 切换到 shuffle 时初始化随机队列
      if (mode === 'shuffle' && prev !== 'shuffle') {
        const { queue, queueIndex } = get()
        shuffledQueue = shuffleArray(queue)
        // 保持当前播放位置在随机队列中
        if (queueIndex >= 0 && queueIndex < queue.length) {
          shuffledIndex = shuffledQueue.indexOf(queue[queueIndex])
          if (shuffledIndex < 0) shuffledIndex = 0
        } else {
          shuffledIndex = 0
        }
      }
    },

    addToQueue(songId) {
      set((s) => ({ queue: [...s.queue, songId] }))
    },

    removeFromQueue(index) {
      set((s) => ({
        queue: s.queue.filter((_, i) => i !== index),
        queueIndex:
          index < s.queueIndex
            ? s.queueIndex - 1
            : index === s.queueIndex
              ? Math.min(s.queueIndex, s.queue.length - 2)
              : s.queueIndex,
      }))
    },

    clearQueue() {
      set({ queue: [], queueIndex: -1 })
      shuffledQueue = []
      shuffledIndex = 0
    },
  }
})
