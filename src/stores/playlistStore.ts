/**
 * 歌单状态 Store
 */
import { create } from 'zustand'
import { playlistService } from '../db/playlistService'
import type { Playlist } from '../types'

interface PlaylistStore {
  playlists: Playlist[]
  loading: boolean

  loadPlaylists: () => Promise<void>
  createPlaylist: (name: string, description?: string) => Promise<Playlist>
  deletePlaylist: (id: string) => Promise<void>
  addSong: (playlistId: string, songId: string) => Promise<void>
  removeSong: (playlistId: string, songId: string) => Promise<void>
  reorder: (playlistId: string, songIds: string[]) => Promise<void>
  updateMeta: (id: string, name: string, description?: string) => Promise<void>
}

export const usePlaylistStore = create<PlaylistStore>((set) => ({
  playlists: [],
  loading: false,

  async loadPlaylists() {
    set({ loading: true })
    const playlists = await playlistService.getAll()
    set({ playlists, loading: false })
  },

  async createPlaylist(name, description) {
    const pl = await playlistService.create(name, description)
    set((s) => ({ playlists: [pl, ...s.playlists] }))
    return pl
  },

  async deletePlaylist(id) {
    await playlistService.delete(id)
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
  },

  async addSong(playlistId, songId) {
    await playlistService.addSong(playlistId, songId)
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, songIds: [...p.songIds, songId], updatedAt: Date.now() }
          : p
      ),
    }))
  },

  async removeSong(playlistId, songId) {
    await playlistService.removeSong(playlistId, songId)
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, songIds: p.songIds.filter((id) => id !== songId), updatedAt: Date.now() }
          : p
      ),
    }))
  },

  async reorder(playlistId, songIds) {
    await playlistService.reorder(playlistId, songIds)
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds, updatedAt: Date.now() } : p
      ),
    }))
  },

  async updateMeta(id, name, description) {
    await playlistService.updateMeta(id, name, description)
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, name, description: description ?? p.description, updatedAt: Date.now() } : p
      ),
    }))
  },
}))
