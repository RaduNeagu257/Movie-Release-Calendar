// ── src/pages/recommended.tsx ──

import { useState, useEffect } from 'react'
import { useRouter }       from 'next/router'
import axios               from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBookmark as fasBookmarkSolid
} from '@fortawesome/free-solid-svg-icons'
import {
  faBookmark as farBookmarkRegular
} from '@fortawesome/free-regular-svg-icons'

// These are the same imports you use in watchlist.tsx :contentReference[oaicite:1]{index=1}
import {
  faThumbsUp as fasThumbsUp,
  faThumbsDown as fasThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import {
  faThumbsUp as farThumbsUp,
  faThumbsDown as farThumbsDown,
} from '@fortawesome/free-regular-svg-icons'

interface Genre { id: number; name: string }

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

interface PrefsResponse {
  preferencesCompleted: boolean
  genreIds: number[]
}

interface Release {
  id:           number
  tmdbId:       number
  title:        string
  releaseDate:  string
  type:         'movie' | 'tv'
  posterPath:   string | null
  genres:       Genre[]
  overview:    string 
}

export default function RecommendedPage() {
  const [preferences,    setPreferences]    = useState<PrefsResponse | null>(null)
  const [allGenres,      setAllGenres]      = useState<Genre[]>([])
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])
  const [recommended,    setRecommended]    = useState<Release[]>([])
  const [watchlist,      setWatchlist]      = useState<WatchlistRelease[]>([])
  const [loading,        setLoading]        = useState(true)
  const [savingPrefs,    setSavingPrefs]    = useState(false)

  const router = useRouter()
  const API = `${process.env.NEXT_PUBLIC_BASE_URL}:${process.env.NEXT_PUBLIC_BACKEND_PORT}`;

  // 1) On mount: fetch prefs, genres, watchlist
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    Promise.all([
      axios.get<PrefsResponse>(`${API}/user/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get<Genre[]>(`${API}/genres`),
      axios.get<WatchlistRelease[]>(`${API}/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
    .then(([prefRes, genresRes, wlRes]) => {
      setPreferences(prefRes.data)
      setSelectedGenres(prefRes.data.genreIds)
      setAllGenres(genresRes.data)
      setWatchlist(wlRes.data)
    })
    .catch(err => {
      console.error(err)
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push('/login')
      }
    })
    .finally(() => setLoading(false))
  }, [API, router])

  // 2) Once prefs done, fetch recommended ±30d
  useEffect(() => {
    if (!preferences?.preferencesCompleted) return
    const today = new Date()
    const past  = new Date(today); past.setDate(today.getDate() - 30)
    const fut   = new Date(today); fut.setDate(today.getDate() + 30)
    const inRange = (d: string) => {
      const dt = new Date(d); return dt >= past && dt <= fut
    }

    const fetchRecs = async () => {
      const map = new Map<number, Release>()
      for (const gid of preferences.genreIds) {
        const res = await axios.get<any[]>(`${API}/releaseGenre`, { params: { genreId: gid } })
        for (const item of res.data) {
          const r = item.release as Release
          if (!inRange(r.releaseDate)) continue
          if (!map.has(r.id)) map.set(r.id, { ...r, genres: [item.genre] })
          else map.get(r.id)!.genres.push(item.genre)
        }
      }
      setRecommended(
        Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.releaseDate).getTime() -
            new Date(a.releaseDate).getTime()
        )
      )
    }

    fetchRecs().catch(console.error)
  }, [preferences, API])

  // 3) Save preferences
  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      const token = localStorage.getItem('token')!
      await axios.post(`${API}/user/preferences`, { genreIds: selectedGenres }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPreferences({ preferencesCompleted: true, genreIds: selectedGenres })
    } catch (err) {
      console.error(err)
    } finally {
      setSavingPrefs(false)
    }
  }

  // 4) Toggle Track (same as watchlist.tsx)
  const toggleTrack = async (releaseId: number) => {
    const token = localStorage.getItem('token')!
    const entry = watchlist.find(e => e.id === releaseId)

    if (entry) {
      await axios.delete(`${API}/watchlist/${releaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setWatchlist(wl => wl.filter(e => e.id !== releaseId))
    } else {
      const res = await axios.post(`${API}/watchlist`, {
        releaseId, watched: false, rating: null
      }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // pull full Release details from `recommended`
      const r = recommended.find(r => r.id === releaseId)!
      setWatchlist(wl => [
        {
          id:          r.id,
          title:       r.title,
          releaseDate: r.releaseDate,
          type:        r.type,
          posterPath:  r.posterPath,
          genres:      r.genres,
          watched:     res.data.watched,
          rating:      res.data.rating as RatingValue,
        },
        ...wl,
      ])
    }
  }

  // 5) Toggle “Seen” :contentReference[oaicite:3]{index=3}
  // Before: if no entry, return early
// const toggleWatched = async (releaseId: number) => {
//   const entry = watchlist.find(e => e.id === releaseId)
//   if (!entry) return
//   // … PATCH logic …
// }

// After: upsert‐style, create+watched:true if needed:
const toggleWatched = async (releaseId: number) => {
    const token = localStorage.getItem('token')!
    // find existing watchlist entry
    const entry = watchlist.find((e) => e.id === releaseId)
  
    if (!entry) {
      // not yet tracked → POST with watched: true
      try {
        const res = await axios.post(
          `${API}/watchlist`,
          { releaseId, watched: true, rating: null },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        // find the corresponding Release in your recommended list
        const r = recommended.find((r) => r.id === releaseId)!
        // add the new entry into watchlist state
        setWatchlist((wl) => [
          {
            id:          r.id,
            title:       r.title,
            releaseDate: r.releaseDate,
            type:        r.type,
            posterPath:  r.posterPath,
            genres:      r.genres,
            watched:     res.data.watched, // should be true
            rating:      res.data.rating as RatingValue, // null
          },
          ...wl,
        ])
      } catch (err) {
        console.error('Error creating & watching:', err)
      }
    } else {
      // already tracked → PATCH to toggle watched
      try {
        const res = await axios.patch(
          `${API}/watchlist/${releaseId}`,
          { watched: !entry.watched },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setWatchlist((wl) =>
          wl.map((e) =>
            e.id === releaseId ? { ...e, watched: res.data.watched } : e
          )
        )
      } catch (err) {
        console.error('Error toggling watched:', err)
      }
    }
  }
  

  // 6) Set “Like” / “Dislike” :contentReference[oaicite:4]{index=4}
  const setRating = async (releaseId: number, newRating: RatingValue) => {
    const token = localStorage.getItem('token')!
    const entry = watchlist.find(e => e.id === releaseId)
    if (!entry) return

    const finalRating = entry.rating === newRating ? null : newRating
    const res = await axios.patch(`${API}/watchlist/${releaseId}`, {
      rating: finalRating
    }, {
      headers: { Authorization: `Bearer ${token}` },
    })
    setWatchlist(wl =>
      wl.map(e =>
        e.id === releaseId ? { ...e, rating: res.data.rating } : e
      )
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
        Loading…
      </div>
    )
  }

  if (!preferences?.preferencesCompleted) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
        <h1 className="text-3xl mb-4 text-purple-primary text-center">
          Choose your favorite genres
        </h1>
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2">
          {allGenres.map(g => (
            <label key={g.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedGenres.includes(g.id)}
                onChange={() =>
                  setSelectedGenres(sel =>
                    sel.includes(g.id)
                      ? sel.filter(x => x !== g.id)
                      : [...sel, g.id]
                  )
                }
                className="form-checkbox h-5 w-5 text-purple-primary"
              />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
        <div className="text-center mt-6">
          <button
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="bg-purple-primary px-6 py-2 rounded text-white disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.push('/')}
          className="bg-purple-primary px-4 py-2 rounded text-white"
        >
          Home
        </button>
        <h1 className="text-3xl font-bold text-purple-primary">
          Recommended
        </h1>
        <div className="w-20" />
      </div>

      {recommended.length === 0 ? (
        <p className="text-center text-gray-400">
          No releases in the ±30-day window for your genres.
        </p>
      ) : (
        <ul className="space-y-6 max-w-3xl mx-auto">
          {recommended.map(r => {
            const entry     = watchlist.find(e => e.id === r.id)
            const isTracked = Boolean(entry)
            const isWatched = entry?.watched ?? false
            const rating    = entry?.rating   ?? null

            const posterUrl = r.posterPath
              ? `https://image.tmdb.org/t/p/w500${r.posterPath}`
              : null

            return (
              <li
                key={r.id}
                className="bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col sm:flex-row"
              >
                {/* LEFT: Poster + Details */}
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={`${r.title} cover`}
                    className="w-full sm:w-48 object-cover"
                  />
                ) : (
                  <div className="w-full sm:w-48 bg-gray-700 flex items-center justify-center text-gray-400 h-64">
                    No Image
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {r.title}
                    </h2>
                    <p className="text-gray-300 mb-1">
                      Date: {new Date(r.releaseDate).toLocaleDateString()}
                    </p>
                    <p className="text-gray-300 mb-1">
                      Type: {r.type === 'movie' ? 'Movie' : 'TV Show'}
                    </p>
                    <p className="text-gray-300 mb-2">
                      Genres: {r.genres.map(g => g.name).join(', ')}
                    </p>
                    <h3 className="text-xl font-medium mt-4 mb-1">Overview</h3>
                    <p className="text-gray-300 text-sm">{r.overview}</p>
                  </div>
                </div>

                {/* RIGHT: Track + Seen + Like/Dislike */}
                <div className="self-center flex space-x-4">
                  {/* ─── COLUMN 1: Track (always) + Like (only if watched) ─── */}
                  <div className="flex flex-col items-center space-y-1">
                    {/* TRACK BUTTON */}
                    <button
                      onClick={() => toggleTrack(r.id)}
                      className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                    >
                      <FontAwesomeIcon
                        icon={isTracked ? fasBookmarkSolid : farBookmarkRegular}
                        className="h-8 w-8 text-white"
                      />
                      <span className="mt-1 text-xs text-white">Track</span>
                    </button>

                    {isWatched && (
                      <button
                        onClick={() => setRating(r.id, 'LIKE')}
                        className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                      >
                        {rating === 'LIKE' ? (
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
                    )}
                  </div>

                  {/* ─── COLUMN 2: Seen (always) + Dislike (only if watched) ─── */}
                  <div className="flex flex-col items-center space-y-1">
                    {/* SEEN BUTTON */}
                    <button
                      onClick={() => toggleWatched(r.id)}
                      className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-8 w-8 ${isWatched ? 'text-green-400' : 'text-gray-400'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="mt-1 text-xs text-white">Seen</span>
                    </button>

                    {isWatched && (
                      <button
                        onClick={() => setRating(r.id, 'DISLIKE')}
                        className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                      >
                        {rating === 'DISLIKE' ? (
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
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
