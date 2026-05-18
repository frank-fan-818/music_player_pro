/**
 * 曲库状态 Store
 * 管理: 歌曲列表、歌手分组、导入/删除/收藏操作、最近播放
 */
import { create } from 'zustand'
import { songService } from '../db/songService'
import { useAudioStore } from './audioStore'
import type { Song, ArtistGroup, AlbumGroup } from '../types'

interface LibraryStore {
  songs: Song[]
  artists: ArtistGroup[]
  albums: AlbumGroup[]
  recentIds: string[]
  loading: boolean

  loadLibrary: () => Promise<void>
  importFiles: (files: File[]) => Promise<Song[]>
  deleteSong: (id: string) => Promise<void>
  deleteSongs: (ids: string[]) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  addToRecent: (id: string) => void
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  songs: [],
  artists: [],
  albums: [],
  recentIds: loadRecentFromStorage(),
  loading: false,

  async loadLibrary() {
    set({ loading: true })
    const [songs, artists, albums] = await Promise.all([
      songService.getAll(),
      songService.getArtists(),
      songService.getAlbums(),
    ])
    set({ songs, artists, albums, loading: false })
  },

  async importFiles(files, onProgress?: (current: number, total: number, fileName: string) => void) {
    set({ loading: true })
    const imported = await songService.importFiles(files, onProgress)
    await get().loadLibrary()
    // 同步 audioStore: LRC 导入后当前播放歌曲的歌词需要刷新
    const cs = useAudioStore.getState().currentSong
    if (cs) {
      const updated = get().songs.find((s) => s.id === cs.id)
      if (updated && updated.lyrics !== cs.lyrics) {
        useAudioStore.setState({ currentSong: updated })
      }
    }
    return imported
  },

  async deleteSong(id) {
    await songService.delete(id)
    await get().loadLibrary()
  },

  async deleteSongs(ids: string[]) {
    await songService.deleteMany(ids)
    await get().loadLibrary()
  },

  async toggleFavorite(id) {
    await songService.toggleFavorite(id)
    set((s) => {
      const updated = s.songs.map((song) =>
        song.id === id ? { ...song, isFavorite: !song.isFavorite } : song
      )
      // 同步 audioStore 的 currentSong (修复收藏按钮 UI 不更新)
      const toggled = updated.find((song) => song.id === id)
      if (toggled) {
        useAudioStore.setState({ currentSong: toggled })
      }
      return { songs: updated }
    })
  },

  async updateLyrics(id: string, lyrics: string) {
    await songService.updateLyrics(id, lyrics)
    set((s) => ({
      songs: s.songs.map((song) => song.id === id ? { ...song, lyrics } : song),
    }))
    // 同步 audioStore
    const st = useAudioStore.getState()
    if (st.currentSong?.id === id) {
      useAudioStore.setState({ currentSong: { ...st.currentSong, lyrics } })
    }
  },

  addToRecent(id) {
    const ids = [id, ...get().recentIds.filter((i) => i !== id)].slice(0, 20)
    set({ recentIds: ids })
    saveRecentToStorage(ids)
  },
}))

// 最近播放持久化到 localStorage
function loadRecentFromStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem('recent_ids') || '[]')
  } catch {
    return []
  }
}
function saveRecentToStorage(ids: string[]) {
  localStorage.setItem('recent_ids', JSON.stringify(ids))
}
