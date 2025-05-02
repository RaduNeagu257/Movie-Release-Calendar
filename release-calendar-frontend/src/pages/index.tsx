import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'

interface Genre { tmdbId: number; name: string }
interface Release {
  id: number
  title: string
  releaseDate: string
  type: 'movie' | 'tv'
  genres: Genre[]
  dateOnly: string
}

const Calendar = dynamic(() => import('../components/Calendar'), { ssr: false })

export default function Home() {
  const [genres, setGenres]           = useState<Genre[]>([])
  const [releases, setReleases]       = useState<Release[]>([])
  const [events, setEvents]           = useState<{ title: string; date: string }[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [typeFilter, setTypeFilter]   = useState<'movie'|'tv'|''>('')
  const [genreFilter, setGenreFilter] = useState<number|''>('')

  const API = process.env.NEXT_PUBLIC_API_URL

  // 1. Load genres once
  useEffect(() => {
    axios.get<Genre[]>(`${API}/genres`)
      .then(res => setGenres(res.data))
      .catch(console.error)
  }, [])

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
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4">Release Calendar</h1>

      {/* Filters */}
      <div className="flex space-x-4 mb-6">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as any)}
          className="p-2 border rounded"
        >
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="tv">TV Show</option>
        </select>

        <select
          value={genreFilter}
          onChange={e => setGenreFilter(Number(e.target.value) || '')}
          className="p-2 border rounded"
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

        <aside className="bg-white p-4 rounded-2xl shadow">
          <h2 className="text-xl mb-2">
            {selectedDate || 'Select a date'}
          </h2>
          {selectedDate && dayList.length === 0 && <p>No releases.</p>}
          <ul className="space-y-2">
            {dayList.map(r => (
              <li key={r.id} className="p-2 border rounded">
                <strong>{r.title}</strong> ({r.type})
                <div className="text-sm text-gray-600">
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
