// pages/index.tsx

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faThumbsUp as fasThumbsUp,
  faThumbsDown as fasThumbsDown,
  faBookmark as fasBookmarkSolid,
} from '@fortawesome/free-solid-svg-icons'
import {
  faThumbsUp as farThumbsUp,
  faThumbsDown as farThumbsDown,
  faBookmark as farBookmarkRegular,
} from '@fortawesome/free-regular-svg-icons'

interface Genre { id: number; name: string }
type RatingValue = 'LIKE' | 'DISLIKE' | null

// Minimal shape for the carousels
interface Release {
  id:         number
  title:      string
  posterPath: string | null
}

// Full details for the modal
interface ReleaseDetails extends Release {
  releaseDate: string
  type:        'movie' | 'tv'
  genres:      Genre[]
  watched:     boolean
  rating:      RatingValue
  overview:    string
}

export default function HomePage() {
  const router = useRouter()

  // — Carousels —
  const [popular, setPopular]       = useState<Release[]>([])
  const [recommended, setRecommended] = useState<Release[]>([])
  const [baseTitle, setBaseTitle]   = useState<string>('')

  // — Auth/UI state —
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail]             = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen]       = useState(false)

  // — Scroll arrows —
  const [popLeft, setPopLeft] = useState(false)
  const [popRight, setPopRight] = useState(false)
  const [recLeft, setRecLeft] = useState(false)
  const [recRight, setRecRight] = useState(false)

  const popRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<HTMLDivElement>(null)

  // — Modal state —
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDetails | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL || ''

  // ─── Authentication ───
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true)
      const email = localStorage.getItem('email')
      setUserEmail(email?.split('@')[0] || null)
    }
  }, [])

  const handleSignIn = () => router.push('/login')
  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    setIsAuthenticated(false)
    setDropdownOpen(false)
  }

  // ─── Fetch Popular ───
  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const today = new Date()
        const past  = new Date(today); past.setDate(today.getDate() - 30)
        const fut   = new Date(today); fut.setDate(today.getDate() + 30)
        const startDate = past.toISOString().split('T')[0]
        const endDate   = fut.toISOString().split('T')[0]
        const res = await axios.get<Release[]>(
          `${API}/releases/popular`,
          { params: { startDate, endDate, limit: 20 } }
        )
        setPopular(res.data)
      } catch (e) {
        console.error('Failed to load popular', e)
      }
    }
    fetchPopular()
  }, [API])

  // ─── Fetch Recommended ───
  useEffect(() => {
    if (!isAuthenticated) return
    const fetchRec = async () => {
      try {
        const res = await axios.get<{ base: Release | null; items: Release[] }>(
          `${API}/releases/recommended`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            params: { limit: 20 }
          }
        )
        if (res.data.base && res.data.items.length) {
          setBaseTitle(res.data.base.title)
          setRecommended(res.data.items)
        }
      } catch (e) {
        console.error('Failed to load recommended', e)
      }
    }
    fetchRec()
  }, [API, isAuthenticated])

  // ─── Scroll arrow logic ───
  const updateButtons = (
    el: HTMLDivElement | null,
    setL: React.Dispatch<React.SetStateAction<boolean>>,
    setR: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setL(scrollLeft > 0)
    setR(scrollLeft + clientWidth < scrollWidth)
  }

  useEffect(() => {
    const el = popRef.current
    if (!el) return
    const onScroll = () => updateButtons(el, setPopLeft, setPopRight)
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [popular])

  useEffect(() => {
    const el = recRef.current
    if (!el) return
    const onScroll = () => updateButtons(el, setRecLeft, setRecRight)
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [recommended])

  // ─── Scroll handlers ───
  const scrollPopularBy = (d: number) => popRef.current?.scrollBy({ left: d, behavior: 'smooth' })
  const scrollRecommendedBy = (d: number) => recRef.current?.scrollBy({ left: d, behavior: 'smooth' })

  // ─── Open modal on click ───
  const onPosterClick = async (id: number) => {
    try {
      const { data } = await axios.get<ReleaseDetails>(
        `${API}/releases`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { id, include: 'overview,genres,watchlist' }
        }
      )
      setSelectedRelease(data)
    } catch (e) {
      console.error('Failed to load details', e)
    }
  }

  // ─── In‐modal handlers ───
  const toggleWatched = async (rid: number) => {
    if (!selectedRelease) return
    const newWatched = !selectedRelease.watched
    try {
      const res = await axios.patch(
        `${API}/watchlist/${rid}`,
        { watched: newWatched },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      setSelectedRelease(sr => sr && { ...sr, watched: res.data.watched })
    } catch (e) { console.error(e) }
  }
  const setRating = async (rid: number, r: RatingValue) => {
    if (!selectedRelease) return
    const final = selectedRelease.rating === r ? null : r
    try {
      const res = await axios.patch(
        `${API}/watchlist/${rid}`,
        { rating: final },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      setSelectedRelease(sr => sr && { ...sr, rating: res.data.rating })
    } catch (e) { console.error(e) }
  }
  const toggleTrack = async (rid: number) => {
    if (!selectedRelease) return
    try {
      if (selectedRelease.watched || selectedRelease.rating !== null) {
        // already tracked → delete
        await axios.delete(
          `${API}/watchlist/${rid}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
        setSelectedRelease(sr => sr && { ...sr, watched: false, rating: null })
      } else {
        // not tracked → add
        const res = await axios.post(
          `${API}/watchlist`,
          { releaseId: rid, watched: false, rating: null },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
        setSelectedRelease(sr => sr && ({ ...sr, watched: res.data.watched, rating: res.data.rating }))
      }
    } catch (e) { console.error(e) }
  }

  return (
    <div className="bg-gray-900 text-gray-100 p-6 space-y-10">
      {/* ── HEADER ── */}
      <div className="flex justify-end items-center mb-4 space-x-4">
        <button
          onClick={() => router.push('/releaseCalendar')}
          className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
        >Calendar</button>

        {!isAuthenticated
          ? <button
              onClick={handleSignIn}
              className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
            >Sign In</button>
          : (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="bg-purple-primary text-white px-4 py-2 rounded hover:bg-purple-dark"
              >{userEmail}</button>
              {dropdownOpen && (
                <ul className="absolute right-0 mt-2 bg-gray-800 text-white rounded shadow-lg w-48 z-50">
                  <li><button onClick={() => router.push('/recommended')} className="w-full text-left px-4 py-2 hover:bg-purple-dark">Recommended</button></li>
                  <li><button onClick={() => router.push('/watchlist')}   className="w-full text-left px-4 py-2 hover:bg-purple-dark">Watchlist</button></li>
                  <li><button onClick={() => router.push('/ratings')}     className="w-full text-left px-4 py-2 hover:bg-purple-dark">Your Ratings</button></li>
                  <li><button onClick={handleSignOut}                     className="w-full text-left px-4 py-2 hover:bg-purple-dark">Sign Out</button></li>
                </ul>
              )}
            </div>
          )
        }
      </div>

      {/* ── POPULAR ── */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Popular</h2>
        <div className="relative">
          {popLeft  && <button onClick={() => scrollPopularBy(-200)} className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10"><ChevronLeft /></button>}
          <div ref={popRef} className="flex overflow-x-auto space-x-4 pb-4">
            {popular.map(r => (
              <div key={r.id} className="flex-shrink-0 w-40">
                <img
                  src={r.posterPath ? `https://image.tmdb.org/t/p/w300${r.posterPath}` : '/placeholder.png'}
                  alt={r.title}
                  className="w-full h-auto rounded-lg shadow-lg object-cover cursor-pointer"
                  onClick={() => onPosterClick(r.id)}
                />
              </div>
            ))}
          </div>
          {popRight && <button onClick={() => scrollPopularBy(200)}  className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10"><ChevronRight/></button>}
        </div>
      </section>

      {/* ── RECOMMENDED ── */}
      {isAuthenticated && recommended.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-2">Recommended: {baseTitle}</h2>
          <div className="relative">
            {recLeft  && <button onClick={() => scrollRecommendedBy(-200)} className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10"><ChevronLeft/></button>}
            <div ref={recRef} className="flex overflow-x-auto space-x-4 pb-4">
              {recommended.map(r => (
                <div key={r.id} className="flex-shrink-0 w-40">
                  <img
                    src={r.posterPath ? `https://image.tmdb.org/t/p/w300${r.posterPath}` : '/placeholder.png'}
                    alt={r.title}
                    className="w-full h-auto rounded-lg shadow-lg object-cover cursor-pointer"
                    onClick={() => onPosterClick(r.id)}
                  />
                </div>
              ))}
            </div>
            {recRight && <button onClick={() => scrollRecommendedBy(200)}  className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10"><ChevronRight/></button>}
          </div>
        </section>
      )}

      {/* ── MODAL ── */}
      {selectedRelease && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-3xl w-full">
            {/* ✕ CLOSE */}
            <button
              onClick={() => setSelectedRelease(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
            >✕</button>

            {/* TILE */}
            <div className="bg-gray-800 text-gray-100 rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row">
              {/* Poster */}
              {selectedRelease.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${selectedRelease.posterPath}`}
                  alt={selectedRelease.title}
                  className="w-full sm:w-48 object-cover"
                />
              ) : (
                <div className="w-full sm:w-48 bg-gray-700 flex items-center justify-center text-gray-400 h-64">
                  No Image
                </div>
              )}

              {/* Details + Overview */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">{selectedRelease.title}</h2>
                  <p className="text-gray-300 mb-1">
                    <span className="font-medium">Date:</span>{' '}
                    {new Date(selectedRelease.releaseDate).toLocaleDateString()}
                  </p>
                  <p className="text-gray-300 mb-1">
                    <span className="font-medium">Type:</span>{' '}
                    {selectedRelease.type === 'movie' ? 'Movie' : 'TV Show'}
                  </p>
                  <p className="text-gray-300 mb-2">
                    <span className="font-medium">Genres:</span>{' '}
                    {(selectedRelease.genres ?? []).map(g => g.name).join(', ')}
                  </p>
                  <h3 className="text-xl font-medium mt-4 mb-1">Overview</h3>
                  <p className="text-gray-300 text-sm">{selectedRelease.overview}</p>
                </div>
              </div>

              {/* Buttons: Track/Like + Seen/Dislike */}
              <div className="self-center flex space-x-4 p-4">
                {/* Col 1: Track + Like */}
                <div className="flex flex-col items-center space-y-1">
                  <button
                    onClick={() => toggleTrack(selectedRelease.id)}
                    className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                  >
                    <FontAwesomeIcon
                      icon={selectedRelease.watched || selectedRelease.rating !== null
                        ? fasBookmarkSolid
                        : farBookmarkRegular}
                      className="h-8 w-8 text-white"
                    />
                    <span className="mt-1 text-xs text-white">Track</span>
                  </button>

                  {selectedRelease.watched && (
                    <button
                      onClick={() => setRating(selectedRelease.id, 'LIKE')}
                      className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                    >
                      <FontAwesomeIcon
                        icon={selectedRelease.rating === 'LIKE' ? fasThumbsUp : farThumbsUp}
                        className={`h-8 w-8 ${
                          selectedRelease.rating === 'LIKE' ? 'text-green-500' : 'text-white'
                        }`}
                      />
                      <span className="mt-1 text-xs text-white">Like</span>
                    </button>
                  )}
                </div>

                {/* Col 2: Seen + Dislike */}
                <div className="flex flex-col items-center space-y-1">
                  <button
                    onClick={() => toggleWatched(selectedRelease.id)}
                    className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-8 w-8 ${
                        selectedRelease.watched ? 'text-green-400' : 'text-gray-400'
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

                  {selectedRelease.watched && (
                    <button
                      onClick={() => setRating(selectedRelease.id, 'DISLIKE')}
                      className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
                    >
                      <FontAwesomeIcon
                        icon={selectedRelease.rating === 'DISLIKE' ? fasThumbsDown : farThumbsDown}
                        className={`h-8 w-8 ${
                          selectedRelease.rating === 'DISLIKE' ? 'text-red-500' : 'text-white'
                        }`}
                      />
                      <span className="mt-1 text-xs text-white">Dislike</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
