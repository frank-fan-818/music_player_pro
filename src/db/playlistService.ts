/**
 * 歌单服务层 (PlaylistServiceContract 实现)
 */
import { db } from './schema'
import type { Playlist } from '../types'
import { v4 as uuid } from '../utils/uuid'

export const playlistService = {
  async getAll(): Promise<Playlist[]> {
    return db.playlists.orderBy('updatedAt').reverse().toArray()
  },

  async getById(id: string): Promise<Playlist | undefined> {
    return db.playlists.get(id)
  },

  async create(name: string, description = ''): Promise<Playlist> {
    const now = Date.now()
    const pl: Playlist = {
      id: uuid(),
      name,
      description,
      songIds: [],
      coverUrl: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.playlists.put(pl)
    return pl
  },

  async delete(id: string): Promise<void> {
    await db.playlists.delete(id)
  },

  async addSong(playlistId: string, songId: string): Promise<void> {
    const pl = await db.playlists.get(playlistId)
    if (pl && !pl.songIds.includes(songId)) {
      pl.songIds.push(songId)
      pl.updatedAt = Date.now()
      await db.playlists.put(pl)
    }
  },

  async removeSong(playlistId: string, songId: string): Promise<void> {
    const pl = await db.playlists.get(playlistId)
    if (pl) {
      pl.songIds = pl.songIds.filter((id) => id !== songId)
      pl.updatedAt = Date.now()
      await db.playlists.put(pl)
    }
  },

  async reorder(playlistId: string, songIds: string[]): Promise<void> {
    await db.playlists.update(playlistId, { songIds, updatedAt: Date.now() })
  },

  async updateMeta(id: string, name: string, description?: string): Promise<void> {
    const updates: Partial<Playlist> = { name, updatedAt: Date.now() }
    if (description !== undefined) updates.description = description
    await db.playlists.update(id, updates)
  },
}
