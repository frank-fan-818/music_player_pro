/**
 * 歌曲服务层 v2
 *
 * v2 变更:
 *   - C3 fix: audioData 分离到 songAudio 表, 列表查询不再加载 Blob
 *   - H3 fix: 导入前 navigator.storage.estimate() 配额检查
 *   - H5 fix: delete/deleteMany 使用 Dexie transaction 保证原子性
 */
import { db } from './schema'
import type { Song, SongMeta, ArtistGroup, AlbumGroup, ImportTask } from '../types'
import { v4 as uuid } from '../utils/uuid'
import { parseMetadata } from '../utils/id3Parser'

// === 多歌手拆分 ===
/** 按 / ; & 分割多歌手，trim 并过滤空字符串 */
function splitArtistNames(raw: string): string[] {
  return raw.split(/\s*[/;&]\s*/).filter(Boolean)
}

// === 音频时长探测 (仅用于导入时的回退 — 优先从元数据读取) ===
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

// === 导入工作流 (Pipeline 模式) ===
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
    // Step 1: 格式校验
    updateTask('format_check')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['mp3', 'm4a', 'flac', 'wav', 'ogg'].includes(ext)) {
      updateTask('format_check', `不支持的格式: .${ext}`)
      return null
    }

    // Step 2: ID3 解析
    updateTask('id3_parse')
    const metadata = await parseMetadata(file)

    // Step 3: 读取文件数据
    const audioBuffer = await file.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: file.type || 'audio/mpeg' })

    // Step 4: 时长探测 (Web Audio API, 不依赖 ID3 元数据)
    updateTask('duration_detect')
    const duration = await detectDuration(audioBuffer)

    // Step 5: 写入数据库
    updateTask('db_write')
    const id = uuid()

    // C3 fix: audioData 写入独立的 songAudio 表
    const songEntry: SongMeta = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      coverArt: metadata.coverArt,
      lyrics: metadata.lyrics || externalLyrics || null,
      duration,
      fileSize: file.size,
      format: ext,
      sampleRate: 44100,
      bitrate: Math.round((file.size * 8) / (duration || 1)),
      trackNumber: metadata.trackNumber,
      isFavorite: false,
      importedAt: Date.now(),
    }

    // H5 fix: 事务写入 — songs + songAudio 原子操作
    await db.transaction('rw', db.songs, db.songAudio, async () => {
      await db.songs.put(songEntry)
      await db.songAudio.put({ id, audioData: audioBlob })
    })

    return { ...songEntry, audioData: audioBlob }
  } catch (err: any) {
    updateTask(task.currentStep, err.message || '导入失败')
    return null
  }
}

// === 导出服务 ===
export const songService = {
  /** 获取所有歌曲元信息 (不含音频数据, C3 fix) */
  async getAll(): Promise<SongMeta[]> {
    return db.songs.orderBy('importedAt').reverse().toArray()
  },

  /** 获取单首歌曲 (含音频数据, 用于播放) */
  async getById(id: string): Promise<Song | undefined> {
    const meta = await db.songs.get(id)
    if (!meta) return undefined
    // C3 fix: 仅在此处加载音频 Blob
    const audio = await db.songAudio.get(id)
    return { ...meta, audioData: audio?.audioData || new Blob() }
  },

  async getByArtist(artist: string): Promise<SongMeta[]> {
    const all = await db.songs.toArray()
    return all.filter((s) => splitArtistNames(s.artist).includes(artist))
  },

  async getFavorites(): Promise<SongMeta[]> {
    const all = await db.songs.toArray()
    return all.filter((s) => s.isFavorite)
  },

  async importFiles(
    files: File[],
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<Song[]> {
    // 分离 .lrc 文件和音频文件，按 basename 匹配
    const lrcFiles = new Map<string, string>()
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
        const song = allSongs.find((s) => {
          const t = s.title.toLowerCase()
          const b = base.toLowerCase()
          if (t === b) return true
          if (t.startsWith(b)) return true
          if (b.startsWith(t)) return true
          if (b.includes(t) && t.length > 2) return true
          if (t.includes(b) && b.length > 2) return true
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
      return allSongs.filter((s) => s.lyrics).map((s) => {
        // 返回 SongMeta[], 不含 audioData (此路径无需播放)
        return s as Song
      })
    }

    // H3 fix: 导入前检查存储配额
    if (audioFiles.length > 0) {
      const totalBytes = audioFiles.reduce((sum, f) => sum + f.size, 0)
      try {
        const estimate = await navigator.storage?.estimate()
        if (estimate) {
          const available = estimate.quota! - estimate.usage!
          // 保留 50MB 最小缓冲
          if (totalBytes > available - 50 * 1024 * 1024) {
            throw new Error(`存储空间不足! 需要 ${(totalBytes / 1024 / 1024).toFixed(0)}MB, 可用 ${(available / 1024 / 1024).toFixed(0)}MB`)
          }
        }
      } catch (e: any) {
        // storage.estimate() 不可用时跳过检查, 但配额错误仍然抛出
        if (e.message?.includes('存储空间不足')) throw e
      }

      // H3 fix: 检查 IndexedDB 是否可写
      try {
        const testKey = `__quota_test__${Date.now()}`
        await db.songAudio.put({ id: testKey, audioData: new Blob(['test']) })
        await db.songAudio.delete(testKey)
      } catch {
        throw new Error('存储空间不足，请清理后重试')
      }
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

  /** H5 fix: 原子事务 — 清理歌单引用然后删除歌曲及音频 */
  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.songs, db.songAudio, db.playlists, async () => {
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
      await db.songAudio.delete(id)
    })
  },

  /** H5 fix: 批量删除 — 原子事务 */
  async deleteMany(ids: string[]): Promise<void> {
    await db.transaction('rw', db.songs, db.songAudio, db.playlists, async () => {
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
      await db.songAudio.bulkDelete(ids)
    })
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

  async getByAlbum(album: string): Promise<SongMeta[]> {
    const all = await db.songs.toArray()
    return all.filter((s) => s.album === album)
  },

  async updateLyrics(id: string, lyrics: string): Promise<void> {
    await db.songs.update(id, { lyrics })
  },
}
