/**
 * IndexedDB 数据库定义 (第6周: 数据分表设计)
 *
 * 分表理由:
 *   songs - 歌曲实体, 关系型数据, 按歌手/收藏索引
 *   playlists - 歌单实体, 与歌曲多对多关系(通过 songIds)
 *   不合并为一表: 避免歌单变更时更新歌曲行, 减少索引膨胀
 */
import Dexie, { type Table } from 'dexie'
import type { Song, Playlist, ImportTask } from '../types'

export class MusicDB extends Dexie {
  songs!: Table<Song, string>
  playlists!: Table<Playlist, string>
  importTasks!: Table<ImportTask, string>

  constructor() {
    super('MusicPlayerPro')

    this.version(1).stores({
      // 主键id, 索引: 歌手、收藏、导入时间 (支持快速筛选)
      songs: 'id, artist, isFavorite, importedAt, title, album',
      // 主键id, 索引: 更新时间
      playlists: 'id, updatedAt',
      // 导入任务: 主键id, 索引: 状态
      importTasks: 'id, status',
    })
  }
}

export const db = new MusicDB()
