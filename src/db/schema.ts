/**
 * IndexedDB 数据库定义 (v2 - C3 fix)
 *
 * 分表理由:
 *   songs      - 歌曲元信息, 关系型数据, 按歌手/收藏索引
 *   songAudio  - 音频 Blob 独立存储, 仅 getById 时加载, 避免列表查询占满内存
 *   playlists   - 歌单实体, 与歌曲多对多关系(通过 songIds)
 *   importTasks - 导入任务记录
 *
 * v2 变更: 新增 songAudio 表, 将 audioData 从 songs 表分离
 */
import Dexie, { type Table } from 'dexie'
import type { SongMeta, Playlist, ImportTask } from '../types'

export interface SongAudioRecord {
  id: string
  audioData: Blob
}

export class MusicDB extends Dexie {
  songs!: Table<SongMeta, string>
  songAudio!: Table<SongAudioRecord, string>
  playlists!: Table<Playlist, string>
  importTasks!: Table<ImportTask, string>

  constructor() {
    super('MusicPlayerPro')

    this.version(1).stores({
      songs: 'id, artist, isFavorite, importedAt, title, album',
      playlists: 'id, updatedAt',
      importTasks: 'id, status',
    })

    // v2: 音频数据分离到独立表 (C3 fix)
    this.version(2).stores({
      songs: 'id, artist, isFavorite, importedAt, title, album',
      songAudio: 'id',
      playlists: 'id, updatedAt',
      importTasks: 'id, status',
    })
  }
}

export const db = new MusicDB()
