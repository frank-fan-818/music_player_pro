/**
 * 歌曲服务层 (第6周: 契约实现)
 * 按 SongServiceContract 接口实现 IndexedDB CRUD + ID3解析 + 导入工作流
 */
import { db } from './schema'
import type { Song, ArtistGroup, AlbumGroup, ImportTask } from '../types'
import { v4 as uuid } from '../utils/uuid'
import { parseMetadata } from '../utils/id3Parser'

// === 多歌手拆分 ===
/** 按 / ; & 分割多歌手，trim 并过滤空字符串 */
function splitArtistNames(raw: string): string[] {
  return raw.split(/\s*[/;&]\s*/).filter(Boolean)
}

// === 音频时长探测 (Web Audio API 解码获取) ===
async function detectDuration(audioData: ArrayBuffer): Promise<number> {
  const ctx = new AudioContext()
  try {
    const buffer = await ctx.decodeAudioData(audioData.slice(0))
    return buffer.duration
  } catch {
    return 0
  } finally {
    ctx.close()
  }
}

// === 导入工作流 (第7周: Pipeline 模式) ===
// 步骤: format_check → id3_parse → duration_detect → db_write → artist_refresh
async function importOneFile(
  file: File,
  task: ImportTask,
  externalLyrics: string | undefined,
  onProgress?: (task: ImportTask) => void
): Promise<Song | null> {
  const updateTask = (step: string, error?: string) => {
    task.currentStep = step
    if (error) task.errorMsg = error
    onProgress?.(task)
  }

  try {
    // Step 1: 格式校验 (代码控制)
    updateTask('format_check')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['mp3', 'm4a', 'flac', 'wav', 'ogg'].includes(ext)) {
      updateTask('format_check', `不支持的格式: .${ext}`)
      return null
    }

    // Step 2: ID3 解析 (代码控制, jsmediatags库)
    updateTask('id3_parse')
    const metadata = await parseMetadata(file)

    // Step 3: 读取文件数据
    const audioBuffer = await file.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: file.type || 'audio/mpeg' })

    // Step 4: 时长探测 (Web Audio API)
    updateTask('duration_detect')
    const duration = await detectDuration(audioBuffer)

    // Step 5: 写入数据库 (代码控制)
    updateTask('db_write')
    const song: Song = {
      id: uuid(),
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      coverArt: metadata.coverArt,
      lyrics: metadata.lyrics || externalLyrics || null,
      audioData: audioBlob,
      duration,
      fileSize: file.size,
      format: ext,
      sampleRate: 44100,
      bitrate: Math.round((file.size * 8) / (duration || 1)),
      trackNumber: metadata.trackNumber,
      isFavorite: false,
      importedAt: Date.now(),
    }

    await db.songs.put(song)
    return song
  } catch (err: any) {
    updateTask(task.currentStep, err.message || '导入失败')
    return null
  }
}

// === 导出服务(SongServiceContract 实现) ===
export const songService = {
  async getAll(): Promise<Song[]> {
    return db.songs.orderBy('importedAt').reverse().toArray()
  },

  async getById(id: string): Promise<Song | undefined> {
    return db.songs.get(id)
  },

  async getByArtist(artist: string): Promise<Song[]> {
    // 按拆分后的歌手名筛选 (IndexedDB 只支持精确索引，多歌手需内存过滤)
    const all = await db.songs.toArray()
    return all.filter((s) => splitArtistNames(s.artist).includes(artist))
  },

  async getFavorites(): Promise<Song[]> {
    return db.songs.where('isFavorite').equals(1).toArray()
  },

  async importFiles(
    files: File[],
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<Song[]> {
    // 分离 .lrc 文件和音频文件，按 basename 匹配
    const lrcFiles = new Map<string, string>() // basename → lrc content
    const audioFiles: File[] = []
    for (const f of files) {
      if (f.name.endsWith('.lrc')) {
        const base = f.name.replace(/\.lrc$/i, '')
        const text = await f.text()
        lrcFiles.set(base, text)
      } else {
        audioFiles.push(f)
      }
    }

    // 纯 .lrc 导入: 匹配已有歌曲
    if (audioFiles.length === 0 && lrcFiles.size > 0) {
      const allSongs = await db.songs.toArray()
      let matched = 0

      for (const [base, text] of lrcFiles) {
        // 多策略匹配: 精确 → 包含 → 去前缀
        const song = allSongs.find((s) => {
          const t = s.title.toLowerCase()
          const b = base.toLowerCase()
          // 精确匹配
          if (t === b) return true
          // 歌名以文件名开头
          if (t.startsWith(b)) return true
          // 文件名以歌名开头
          if (b.startsWith(t)) return true
          // 文件名包含歌名 (LRC文件名常有 "Artist - Title.lrc")
          if (b.includes(t) && t.length > 2) return true
          // 歌名包含文件名
          if (t.includes(b) && b.length > 2) return true
          // 去掉 "Artist - " 前缀再匹配
          const afterDash = b.replace(/^.*?\s*[-–—]\s*/, '')
          if (afterDash && t === afterDash) return true
          if (afterDash && t.startsWith(afterDash)) return true
          return false
        })
        if (song) {
          await db.songs.update(song.id, { lyrics: text })
          matched++
        }
      }

      console.log(`[lrc] matched ${matched} / ${lrcFiles.size} files`)
      return allSongs.filter((s) => s.lyrics)
    }

    const task: ImportTask = {
      id: uuid(),
      status: 'processing',
      currentStep: 'format_check',
      totalFiles: audioFiles.length,
      processedFiles: 0,
      createdAt: Date.now(),
    }

    const imported: Song[] = []
    for (const file of audioFiles) {
      const base = file.name.replace(/\.[^.]+$/, '')
      const lrcText = lrcFiles.get(base)
      onProgress?.(task.processedFiles, audioFiles.length, file.name)
      const song = await importOneFile(file, task, lrcText, undefined)
      if (song) imported.push(song)
      task.processedFiles++
    }
    onProgress?.(audioFiles.length, audioFiles.length, '')

    task.status = imported.length > 0 ? 'done' : 'failed'
    if (imported.length === 0 && audioFiles.length > 0) {
      task.errorMsg = '没有文件被成功导入'
    }
    await db.importTasks.put(task)
    return imported
  },

  async delete(id: string): Promise<void> {
    // 删除歌曲时同步清理歌单中的引用
    const playlists = await db.playlists.toArray()
    for (const pl of playlists) {
      if (pl.songIds.includes(id)) {
        await db.playlists.update(pl.id, {
          songIds: pl.songIds.filter((sid) => sid !== id),
          updatedAt: Date.now(),
        })
      }
    }
    await db.songs.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    const playlists = await db.playlists.toArray()
    for (const id of ids) {
      for (const pl of playlists) {
        if (pl.songIds.includes(id)) {
          await db.playlists.update(pl.id, {
            songIds: pl.songIds.filter((sid) => sid !== id),
            updatedAt: Date.now(),
          })
        }
      }
    }
    await db.songs.bulkDelete(ids)
  },

  async toggleFavorite(id: string): Promise<void> {
    const song = await db.songs.get(id)
    if (song) {
      await db.songs.update(id, { isFavorite: !song.isFavorite })
    }
  },

  async getArtists(): Promise<ArtistGroup[]> {
    const songs = await db.songs.toArray()
    const map = new Map<string, { count: number; cover: string | null }>()
    for (const s of songs) {
      // 拆分多歌手: "A / B" → ["A", "B"], "A;B" → ["A", "B"]
      const names = splitArtistNames(s.artist)
      for (const name of names) {
        const trimmed = name.trim()
        if (!trimmed) continue
        const existing = map.get(trimmed)
        if (existing) {
          existing.count++
        } else {
          map.set(trimmed, { count: 1, cover: s.coverArt })
        }
      }
    }
    return [...map.entries()].map(([name, data]) => ({
      name,
      songCount: data.count,
      coverArt: data.cover,
    }))
  },

  async getAlbums(): Promise<AlbumGroup[]> {
    const songs = await db.songs.toArray()
    const map = new Map<string, { artist: string; count: number; cover: string | null }>()
    for (const s of songs) {
      const key = s.album
      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, { artist: s.artist, count: 1, cover: s.coverArt })
      }
    }
    return [...map.entries()]
      .filter(([name]) => name !== '未知专辑')
      .map(([name, data]) => ({ name, artist: data.artist, songCount: data.count, coverArt: data.cover }))
  },

  async getByAlbum(album: string): Promise<Song[]> {
    const all = await db.songs.toArray()
    return all.filter((s) => s.album === album)
  },

  async updateLyrics(id: string, lyrics: string): Promise<void> {
    await db.songs.update(id, { lyrics })
  },
}
