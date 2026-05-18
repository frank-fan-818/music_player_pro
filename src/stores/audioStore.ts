/**
 * 播放器状态 Store (第7周: 播放工作流的中央控制器)
 *
 * 控制流程: play → load → engine.play → onTrackEnd → next/stop
 * 自动连播: 顺序/循环/随机/单曲循嬢
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

  // 操作 (第7周: 人机分工 - 全部由代码控制, 无LLM节点)
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

export const useAudioStore = create<AudioStore>((set, get) => {
  // 引擎事件绑定 (只绑定一次)
  let engineBound = false

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
        // 自动连播逻辑 (第7周: Pipeline ended 事件 → 检查队列)
        const { playMode, queue, queueIndex } = get()
        const loadAndPlay = async (id: string, idx: number) => {
          const song = await songService.getById(id)
          if (song) {
            set({ queueIndex: idx, currentSong: song })
            await audioEngine.load(id)
            await audioEngine.play(get().volume)
          }
        }

        if (playMode === 'repeat-one') {
          // 单曲循环: 从头重播
          audioEngine.seek(0)
          await audioEngine.play(get().volume)
        } else if (queueIndex < queue.length - 1) {
          // 有下一首 → 自动切歌
          const nextIdx = queueIndex + 1
          loadAndPlay(queue[nextIdx], nextIdx)
        } else if (playMode === 'repeat-list' && queue.length > 0) {
          // 列表循环: 回到第一首
          loadAndPlay(queue[0], 0)
        }
        // 顺序模式播完末尾 → 停止 (natural end)
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
        audioEngine.resume() // Promise ignored - state updates via listener
      }
    },

    requestNext() {
      const { queue, queueIndex, playMode } = get()
      let nextIdx = queueIndex + 1
      if (nextIdx >= queue.length) {
        nextIdx = playMode === 'repeat-list' ? 0 : -1
      }
      if (nextIdx >= 0 && nextIdx < queue.length) {
        get().requestPlay(queue[nextIdx], queue, nextIdx)
      }
    },

    requestPrevious() {
      const { queue, queueIndex } = get()
      // 如果播放超过3秒, 回到当前歌曲开头
      if (get().currentTime > 3) {
        audioEngine.seek(0)
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
      set({ playMode: mode })
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
    },
  }
})
