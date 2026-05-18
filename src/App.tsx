import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import NowPlayingPage from './pages/NowPlayingPage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import ArtistsPage from './pages/ArtistsPage'
import ArtistDetailPage from './pages/ArtistDetailPage'
import AlbumsPage from './pages/AlbumsPage'
import AlbumDetailPage from './pages/AlbumDetailPage'
import FavoritesPage from './pages/FavoritesPage'
import SettingsPage from './pages/SettingsPage'
import { useLibraryStore } from './stores/libraryStore'
import { usePlaylistStore } from './stores/playlistStore'

export default function App() {
  const loadLibrary = useLibraryStore((s) => s.loadLibrary)
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists)

  useEffect(() => {
    loadLibrary()
    loadPlaylists()
  }, [loadLibrary, loadPlaylists])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/now-playing" replace />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
        <Route path="/artists" element={<ArtistsPage />} />
        <Route path="/artists/:name" element={<ArtistDetailPage />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/albums/:name" element={<AlbumDetailPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
