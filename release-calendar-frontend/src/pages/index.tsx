import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import { useRouter } from 'next/router'

interface Genre { tmdbId: number; name: string }
interface Release {
  id: number
  title: string
  releaseDate: string
  type: 'movie' | 'tv'
  genres: Genre[]
  dateOnly: string
}

const Calendar = dynamic(() => import('./Calendar'), { ssr: false })

export default function Home() {
  const [genres, setGenres]           = useState<Genre[]>([])
  const [releases, setReleases]       = useState<Release[]>([])
  const [events, setEvents]           = useState<{ title: string; date: string }[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [typeFilter, setTypeFilter]   = useState<'movie'|'tv'|''>('')
  const [genreFilter, setGenreFilter] = useState<number|''>('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [userEmail, setUserEmail] = useState<string | null>(null) // Store the user's email
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false) // Handle dropdown state


  const API = process.env.NEXT_PUBLIC_API_URL
  const router = useRouter()

  // 1. Load genres once
  useEffect(() => {
    // Check if the user is authenticated
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true) // User is logged in
      const email = localStorage.getItem('email') // Get email from localStorage (set during login)
      if (email) {
        setUserEmail(email.split('@')[0]) // Set email prefix before '@'
      }
    }

    // Fetch genres
    axios.get<Genre[]>(`${API}/genres`)
      .then(res => setGenres(res.data))
      .catch(console.error)
  }, [])

  // Handle "Sign In" button
  const handleSignIn = () => {
    router.push('/login') // Redirect to login page
  }

  // Handle "My Account" button
  const handleMyAccount = () => {
    router.push('/calendar') // Redirect to the calendar page
  }

  const handleSignOut = () => {
    localStorage.removeItem('token') // Clear token
    localStorage.removeItem('email') // Clear email
    setIsAuthenticated(false) // Set authentication state to false
    handleDropdownToggle() // Close the dropdown
  }

  const handleDropdownToggle = () => {
    setDropdownOpen(!dropdownOpen) // Toggle dropdown visibility
  }

  // 2. Load releases whenever filters change
  useEffect(() => {
    // 1) Build the same params object
    const params: Record<string, any> = {};
    if (typeFilter)  params.type    = typeFilter;
    if (genreFilter) params.genreId = genreFilter;
  
    // 2) Fetch from the pivot endpoint
    axios.get(`${API}/releaseGenre`, { params })
      .then(res => {
        const items: Array<{
          release: {
            id: number;
            title: string;
            releaseDate: string;
            type: 'movie'|'tv';
          };
          genre: { tmdbId: number; name: string };
        }> = res.data;
  
        // 3) Group by release.id
        const map = new Map<number, {
          id: number;
          title: string;
          releaseDate: string;
          dateOnly: string;
          type: 'movie'|'tv';
          genres: { tmdbId: number; name: string }[];
        }>();
  
        items.forEach(({ release, genre }) => {
          const { id, title, releaseDate, type } = release;
          if (!map.has(id)) {
            map.set(id, {
              id,
              title,
              releaseDate,
              dateOnly: releaseDate.split('T')[0],
              type,
              genres: []
            });
          }
          map.get(id)!.genres.push(genre);
        });
  
        // 4) Turn the map into an array
        const normalized = Array.from(map.values());
  
        // 5) Update state
        setReleases(normalized);
        setEvents(normalized.map(r => ({
          title: r.title,
          date:  r.dateOnly
        })));
      })
      .catch(console.error);
  }, [typeFilter, genreFilter]);
  

  // 3. Filter releases for the clicked day
  const dayList = releases
    .filter(r => r.dateOnly === selectedDate)
    .sort((a, b) => a.title.localeCompare(b.title))

    return (
    <div className="min-h-screen p-6 bg-gray-900 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-purple-primary">Release Calendar</h1>

        {/* Authentication Button */}
        <div className="relative">
          {!isAuthenticated ? (
            <button
              onClick={handleSignIn}
              className="bg-purple-primary text-white px-4 py-2 rounded"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={handleDropdownToggle}
              className="bg-purple-primary text-white px-4 py-2 rounded"
            >
              {userEmail} {/* Display user email prefix */}
            </button>
          )}

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 bg-gray-800 text-white rounded shadow-lg w-48">
              <ul>
                <li>
                  <button
                    onClick={() => router.push('/watchlist')}
                    className="block px-4 py-2 text-sm hover:bg-purple-dark"
                  >
                    Watchlist
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => router.push('/ratings')}
                    className="block px-4 py-2 text-sm hover:bg-purple-dark"
                  >
                    Your Ratings
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleSignOut}
                    className="block px-4 py-2 text-sm hover:bg-purple-dark"
                  >
                    Sign Out
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4 mb-6">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as any)}
          className="p-2 border border-gray-700 bg-gray-800 text-gray-200 rounded"
        >
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="tv">TV Show</option>
        </select>

        <select
          value={genreFilter}
          onChange={e => setGenreFilter(Number(e.target.value) || '')}
          className="p-2 border border-gray-700 bg-gray-800 text-gray-200 rounded"
        >
          <option value="">All genres</option>
          {genres.map(g => (
            <option key={g.tmdbId} value={g.tmdbId}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Calendar + Sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Calendar
            events={events}
            onDateClick={date => setSelectedDate(date)}
          />
        </div>

        <aside className="bg-gray-panel p-4 rounded-2xl shadow-inner">
          <h2 className="text-xl mb-2 text-purple-primary">
            {selectedDate || 'Select a date'}
          </h2>
          {selectedDate && dayList.length === 0 && <p>No releases.</p>}
          <ul className="space-y-2">
            {dayList.map(r => (
              <li key={r.id} className="p-2 border border-gray-700 rounded bg-gray-800 hover:bg-purple-dark transition">
                <strong className="text-white">{r.title}</strong>{' '}
                <span className="text-purple-primary">({r.type})</span>
                <div className="text-sm text-gray-400">
                  {r.genres.map(g => g.name).join(', ')}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
