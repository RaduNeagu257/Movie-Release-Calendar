import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import { useRouter } from 'next/router'

// Font Awesome imports for thumbs up/down
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faThumbsUp as fasThumbsUp,
  faThumbsDown as fasThumbsDown,
} from '@fortawesome/free-solid-svg-icons'
import {
  faThumbsUp as farThumbsUp,
  faThumbsDown as farThumbsDown,
} from '@fortawesome/free-regular-svg-icons'

interface Genre {
  id: number
  name: string
}

interface Release {
  id: number
  title: string
  releaseDate: string
  type: 'movie' | 'tv'
  genres: Genre[]
  dateOnly: string
}

type RatingValue = 'LIKE' | 'DISLIKE' | null

interface WatchlistEntry {
  id:       number
  watched:  boolean
  rating:   RatingValue
}

// Dynamic import of FullCalendar (no SSR)
const Calendar = dynamic(() => import('./Calendar'), { ssr: false })

export default function Home() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [events, setEvents] = useState<{ title: string; date: string }[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<'movie' | 'tv' | ''>('')
  const [genreFilter, setGenreFilter] = useState<number | ''>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // WATCHLIST entries contain { id, watched, rating }
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])

  const API = `${process.env.NEXT_PUBLIC_BASE_URL}:${process.env.NEXT_PUBLIC_BACKEND_PORT}`
  const router = useRouter()

  // ─── On mount: check auth, load genres, fetch watchlist ───
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true)
      const email = localStorage.getItem('email')
      if (email) setUserEmail(email.split('@')[0])

      fetch(`${API}/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.status === 401) {
            // Prevent redirection if on the home page
            if (router.pathname !== '/') {
              router.push('/login')
            }
            return []
          }
          if (!res.ok) {
            const errJson = await res.json()
            throw new Error(errJson.error || 'Failed to load watchlist')
          }
          return res.json() as Promise<WatchlistEntry[]>
        })
        .then((data) => {
          setWatchlist(data)
        })
        .catch(console.error)
    }

    axios
      .get<Genre[]>(`${API}/genres`)
      .then((res) => setGenres(res.data))
      .catch(console.error)
  }, [API, router])

  // ─── Load releases whenever filters change ───
  useEffect(() => {
    const params: Record<string, any> = {}
    if (typeFilter) params.type = typeFilter
    if (genreFilter) params.genreId = genreFilter

    axios
      .get(`${API}/releaseGenre`, { params })
      .then((res) => {
        const items: Array<{
          release: {
            id: number
            title: string
            releaseDate: string
            type: 'movie' | 'tv'
          }
          genre: Genre
        }> = res.data

        const map = new Map<number, Release>()
        items.forEach(({ release, genre }) => {
          const { id, title, releaseDate, type } = release
          if (!map.has(id)) {
            map.set(id, {
              id,
              title,
              releaseDate,
              dateOnly: releaseDate.split('T')[0],
              type,
              genres: [],
            })
          }
          map.get(id)!.genres.push(genre)
        })

        const normalized = Array.from(map.values())
        setReleases(normalized)
        setEvents(normalized.map((r) => ({ title: r.title, date: r.dateOnly })))
      })
      .catch(console.error)
  }, [API, typeFilter, genreFilter])

  // ─── Toggle “tracked” on/off ───
  const toggleWatchlist = async (releaseId: number) => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/login')

    const entry = watchlist.find((e) => e.id === releaseId)
    if (entry) {
      // DELETE if already in watchlist
      await fetch(`${API}/watchlist/${releaseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setWatchlist((wl) => wl.filter((e) => e.id !== releaseId))
    } else {
      // POST to add with watched:false, rating:null
      const res = await fetch(`${API}/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ releaseId, watched: false, rating: null }),
      })
      if (res.ok) {
        const newEntry = await res.json()
        setWatchlist((wl) => [
          {
            id: newEntry.releaseId,
            watched: newEntry.watched,
            rating: newEntry.rating as RatingValue,
          },
          ...wl,
        ])
      }
    }
  }

  // ─── Toggle “seen” (watched) on/off ───
  const toggleWatched = async (releaseId: number) => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/login')

    const entry = watchlist.find((e) => e.id === releaseId)
    if (!entry) {
      // POST if not yet in watchlist: watched:true, rating:null
      const res = await fetch(`${API}/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ releaseId, watched: true, rating: null }),
      })
      if (res.ok) {
        const newEntry = await res.json()
        setWatchlist((wl) => [
          {
            id: newEntry.releaseId,
            watched: newEntry.watched,
            rating: newEntry.rating as RatingValue,
          },
          ...wl,
        ])
      }
    } else {
      // PATCH to toggle watched (leave rating unchanged)
      const res = await fetch(`${API}/watchlist/${releaseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ watched: !entry.watched }),
      })
      if (res.ok) {
        setWatchlist((wl) =>
          wl.map((e) =>
            e.id === releaseId ? { ...e, watched: !e.watched } : e
          )
        )
      }
    }
  }

  // ─── Set “like” or “dislike” → patch rating only ───
  const setRating = async (releaseId: number, newRating: RatingValue) => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/login')

    const entry = watchlist.find((e) => e.id === releaseId)
    if (!entry) return

    const finalRating: RatingValue =
      entry.rating === newRating ? null : newRating

    const res = await fetch(`${API}/watchlist/${releaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rating: finalRating }),
    })
    if (res.ok) {
      setWatchlist((wl) =>
        wl.map((e) =>
          e.id === releaseId ? { ...e, rating: finalRating } : e
        )
      )
    }
  }

  const handleSignIn = () => router.push('/login')
  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    setIsAuthenticated(false)
    handleDropdownToggle()
    setWatchlist([]) // Clear watchlist on sign out
  }
  const handleDropdownToggle = () => setDropdownOpen((o) => !o)

  // ─── Build the filtered/sorted dayList ───
  const dayList = releases
    .filter((r) => r.dateOnly === selectedDate)
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-gray-100">
      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-purple-primary">Release Calendar</h1>
        <div className="flex items-center space-x-4">
          {/* HOME BUTTON */}
          <button
            onClick={() => router.push('/')}
            className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
          >
            Home
          </button>

          {/* AUTH DROPDOWN */}
          <div className="relative">
            {!isAuthenticated ? (
              <button
                onClick={handleSignIn}
                className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={handleDropdownToggle}
                className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
              >
                {userEmail}
              </button>
            )}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 bg-gray-800 text-white rounded shadow-lg w-48 z-50">
                <ul>
                  <li>
                    <button
                      onClick={() => router.push('/recommended')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-purple-dark"
                    >
                      Recommended
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => router.push('/watchlist')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-purple-dark"
                    >
                      Watchlist
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => router.push('/ratings')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-purple-dark"
                    >
                      Your Ratings
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-purple-dark"
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FILTERS ===== */}
      <div className="flex space-x-4 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="p-2 border border-gray-700 bg-gray-800 text-gray-200 rounded"
        >
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="tv">TV Show</option>
        </select>

        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(Number(e.target.value) || '')}
          className="p-2 border border-gray-700 bg-gray-800 text-gray-200 rounded"
        >
          <option value="">All genres</option>
        {genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
        </select>
      </div>

      {/* ===== CALENDAR + SIDEBAR ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Calendar events={events} onDateClick={setSelectedDate} />
        </div>

        {/* Sidebar */}
        <aside className="bg-gray-panel p-4 rounded-2xl shadow-inner">
          <h2 className="text-xl mb-2 text-purple-primary">
            {selectedDate || 'Select a date'}
          </h2>
          {selectedDate && dayList.length === 0 && <p>No releases.</p>}

          <ul className="space-y-2">
            {dayList.map((r) => {
              const entry = watchlist.find((e) => e.id === r.id)
              const inList = !!entry
              const isWatched = entry?.watched ?? false
              const rating = entry?.rating // "LIKE" | "DISLIKE" | null

              return (
                <li
                  key={r.id}
                  className="flex justify-between items-center p-2 border border-gray-700 rounded bg-gray-800 hover:bg-purple-dark transition"
                >
                  <div>
                    <strong className="text-white">{r.title}</strong>{' '}
                    <span className="text-purple-primary">({r.type})</span>
                    <div className="text-sm text-gray-400">
                      {r.genres.map((g) => g.name).join(', ')}
                    </div>
                  </div>

{/* ===== BUTTON GROUP ===== */}
<div className="flex space-x-4">
  {/* ─── COLUMN 1: Track (always) + Like (only if watched) ─── */}
  <div className="flex flex-col items-center space-y-1">
    {/* TRACK BUTTON */}
    <button
      onClick={() => toggleWatchlist(r.id)}
      className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
    >
      {inList ? (
        // SOLID bookmark if in watchlist
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M5 3a2 2 0 00-2 2v16l9-7 9 7V5a2 2 0 00-2-2H5z" />
        </svg>
      ) : (
        // OUTLINE bookmark if not in watchlist
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5v14l7-7 7 7V5H5z"
          />
        </svg>
      )}
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
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
        </aside>
      </div>
    </div>
  )
}