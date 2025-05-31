// ── src/pages/watchlist.tsx ──

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faThumbsUp as fasThumbsUp,
  faThumbsDown as fasThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import {
  faThumbsUp as farThumbsUp,
  faThumbsDown as farThumbsDown,
} from '@fortawesome/free-regular-svg-icons'

/**
 * Expanded interface: each WatchlistRelease now includes:
 *   • watched: boolean
 *   • rating: 'LIKE' | 'DISLIKE' | null
 *   • genres: array of { id, name }
 *   • plus the existing fields: id, title, releaseDate, type, posterPath
 */
interface Genre {
  id:     number
  name:   string
}

type RatingValue = 'LIKE' | 'DISLIKE' | null

interface WatchlistRelease {
  id:           number
  title:        string
  releaseDate:  string
  type:         'movie' | 'tv'
  posterPath:   string | null
  genres:       Genre[]
  watched:      boolean
  rating:       RatingValue
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL!

  // ─── Fetch watchlist on mount ───
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetch(`${API}/watchlist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login')
          return []
        }
        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Failed to load watchlist')
        }
        return res.json() as Promise<WatchlistRelease[]>
      })
      .then((data: WatchlistRelease[]) => {
        setWatchlist(data)
        setLoading(false)
      })
      .catch((err: any) => {
        console.error('Error fetching watchlist:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [API, router])

  // ─── Helper to toggle "watched" on/off ───
  const toggleWatched = async (releaseId: number) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    // Find existing entry
    const entry = watchlist.find((e) => e.id === releaseId)
    if (!entry) return

    try {
      const res = await axios.patch(
        `${API}/watchlist/${releaseId}`,
        { watched: !entry.watched },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update local state
      setWatchlist((wl) =>
        wl.map((e) =>
          e.id === releaseId
            ? { ...e, watched: res.data.watched }
            : e
        )
      )
    } catch (err: any) {
      console.error('Error toggling watched:', err.response?.data || err.message)
    }
  }

  // ─── Helper to set or clear rating ("LIKE" / "DISLIKE") ───
  const setRating = async (releaseId: number, newRating: RatingValue) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    // Find existing entry
    const entry = watchlist.find((e) => e.id === releaseId)
    if (!entry) return

    // If clicked the same rating twice, clear it to null
    const finalRating: RatingValue =
      entry.rating === newRating ? null : newRating

    try {
      const res = await axios.patch(
        `${API}/watchlist/${releaseId}`,
        { rating: finalRating },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setWatchlist((wl) =>
        wl.map((e) =>
          e.id === releaseId
            ? { ...e, rating: res.data.rating }
            : e
        )
      )
    } catch (err: any) {
      console.error('Error updating rating:', err.response?.data || err.message)
    }
  }

  // ─── Loading / Error States ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
        <p>Loading your watchlist…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header: Home button + Title */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/')}
          className="bg-purple-primary hover:bg-purple-dark text-white px-4 py-2 rounded"
        >
          Home
        </button>
        <h1 className="text-3xl font-bold text-purple-primary">Your Watchlist</h1>
        <div className="w-20" /> {/* spacer */}
      </div>

      {watchlist.length === 0 ? (
        <p className="text-center text-gray-400">
          You haven't added any releases yet.
        </p>
      ) : (
        <ul className="max-w-3xl mx-auto space-y-6">
          {watchlist.map((release) => {
            const genresArray = release.genres ?? []

            // Build poster URL or fallback
            const posterUrl = release.posterPath
              ? `https://image.tmdb.org/t/p/w500${release.posterPath}`
              : null

            return (
              <li
                key={release.id}
                className="bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col sm:flex-row"
              >
                {/* ─── LEFT: Cover Image + Details ─── */}
                <div className="flex-shrink-0">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={`${release.title} cover`}
                      className="w-full sm:w-48 h-auto object-cover"
                    />
                  ) : (
                    <div className="w-full sm:w-48 bg-gray-700 flex items-center justify-center text-gray-400 h-64">
                      No Image
                    </div>
                  )}
                </div>

                {/* ─── MIDDLE: Release Details ─── */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">{release.title}</h2>
                    <p className="text-gray-300 mb-1">
                      <span className="font-medium">Date:</span>{' '}
                      {new Date(release.releaseDate).toLocaleDateString()}
                    </p>
                    <p className="text-gray-300 mb-1">
                      <span className="font-medium">Type:</span>{' '}
                      {release.type === 'movie' ? 'Movie' : 'TV Show'}
                    </p>
                    <p className="text-gray-300 mb-2">
                      <span className="font-medium">Genres:</span>{' '}
                      {genresArray.map((g) => g.name).join(', ')}
                    </p>
                  </div>
                </div>

                {/* ─── RIGHT: Seen + Like/Dislike Controls ─── */}
                <div className="p-4 flex flex-col items-center space-y-3">
                  {/* SEEN */}
                  <button
                    onClick={() => toggleWatched(release.id)}
                    className="flex flex-col items-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-8 w-8 ${
                        release.watched ? 'text-green-400' : 'text-gray-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="mt-1 text-xs text-white">Seen</span>
                  </button>

                  {/* LIKE / DISLIKE appear only if watched === true */}
                  {release.watched && (
                    <div className="flex space-x-4">
                      {/* LIKE */}
                      <button
                        onClick={() => setRating(release.id, 'LIKE')}
                        className="flex flex-col items-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                      >
                        {release.rating === 'LIKE' ? (
                          <FontAwesomeIcon
                            icon={fasThumbsUp}
                            className="h-8 w-8 text-green-500"
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={farThumbsUp}
                            className="h-8 w-8 text-white"
                          />
                        )}
                        <span className="mt-1 text-xs text-white">Like</span>
                      </button>

                      {/* DISLIKE */}
                      <button
                        onClick={() => setRating(release.id, 'DISLIKE')}
                        className="flex flex-col items-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                      >
                        {release.rating === 'DISLIKE' ? (
                          <FontAwesomeIcon
                            icon={fasThumbsDown}
                            className="h-8 w-8 text-red-500"
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={farThumbsDown}
                            className="h-8 w-8 text-white"
                          />
                        )}
                        <span className="mt-1 text-xs text-white">Dislike</span>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
