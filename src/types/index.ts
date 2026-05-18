// === 核心数据模型 (第6周: 数据建模优先) ===
// 三根支柱: 可靠(字段约束) / 可扩展(分表而非大表) / 可维护(字段含义清晰)

/** 歌曲实体 - 对应 songs 表 */
export interface Song {
  id: string
  title: string // 歌名 (来自ID3或文件名降级)
  artist: string // 歌手 (未知→'未知歌手')
  album: string // 专辑 (未知→'未知专辑')
  coverArt: string | null // 封面图片 base64 data URL
  lyrics: string | null // 歌词 (内嵌 LRC 或纯文本)
  audioData: Blob // MP3 原始数据
  duration: number // 时长(秒)
  fileSize: number // 文件大小(bytes)
  format: string // 格式 (mp3/m4a/flac)
  sampleRate: number // 采样率 (Hz)
  bitrate: number // 比特率 (bps)
  trackNumber: number // 曲序号
  isFavorite: boolean // 收藏标记
  importedAt: number // 导入时间戳
}

/** 歌单实体 - 对应 playlists 表 */
export interface Playlist {
  id: string
  name: string
  description: string
  songIds: string[] // 歌曲ID有序列表
  coverUrl: string | null // 歌单封面 (取第一首歌封面)
  createdAt: number
  updatedAt: number
}

/** 导入任务 - 对应 import_tasks 表 (第7周: 工作流状态机) */
export interface ImportTask {
  id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  currentStep: string // format_check / id3_parse / cover_extract / db_write
  errorMsg?: string
  totalFiles: number
  processedFiles: number
  createdAt: number
}

/** 播放模式 */
export type PlayMode = 'sequential' | 'repeat-one' | 'repeat-list' | 'shuffle'

/** 播放状态 */
export interface PlayerState {
  isPlaying: boolean
  isLoading: boolean
  currentSongId: string | null
  currentTime: number
  duration: number
  volume: number
  playMode: PlayMode
  queue: string[] // songIds
  queueIndex: number
}

/** 歌手聚合 - 内存计算不存DB */
export interface ArtistGroup {
  name: string
  songCount: number
  coverArt: string | null
}

/** 专辑聚合 - 内存计算不存DB */
export interface AlbumGroup {
  name: string
  artist: string
  songCount: number
  coverArt: string | null
}

/** 内部接口契约 - 数据层与UI层的约定 (第6周: 契约优先) */
export interface SongServiceContract {
  getAll(): Promise<Song[]>
  getById(id: string): Promise<Song | undefined>
  getByArtist(artist: string): Promise<Song[]>
  getFavorites(): Promise<Song[]>
  importFiles(files: File[], onProgress?: (task: ImportTask) => void): Promise<Song[]>
  delete(id: string): Promise<void>
  toggleFavorite(id: string): Promise<void>
  getArtists(): Promise<ArtistGroup[]>
}

export interface PlaylistServiceContract {
  getAll(): Promise<Playlist[]>
  getById(id: string): Promise<Playlist | undefined>
  create(name: string, description?: string): Promise<Playlist>
  delete(id: string): Promise<void>
  addSong(playlistId: string, songId: string): Promise<void>
  removeSong(playlistId: string, songId: string): Promise<void>
  reorder(playlistId: string, songIds: string[]): Promise<void>
  updateMeta(id: string, name: string, description?: string): Promise<void>
}
