import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Release {
  id: number
  title: string
  posterPath: string | null
}

interface RecommendationResponse {
  base: Release
  items: Release[]
}

export default function PopularPage() {
  const [popular, setPopular] = useState<Release[]>([])
  const [recommended, setRecommended] = useState<Release[]>([])
  const [baseTitle, setBaseTitle] = useState<string>('')

  // Arrow visibility
  const [popLeft, setPopLeft] = useState(false)
  const [popRight, setPopRight] = useState(false)
  const [recLeft, setRecLeft] = useState(false)
  const [recRight, setRecRight] = useState(false)

  // Refs for scrolling
  const popRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      const today = new Date()
      const past = new Date(today)
      past.setDate(today.getDate() - 30)
      const fut = new Date(today)
      fut.setDate(today.getDate() + 30)

      const startDate = past.toISOString().split('T')[0]
      const endDate = fut.toISOString().split('T')[0]
      const API = process.env.NEXT_PUBLIC_API_URL || ''

      try {
        const [popRes, recRes] = await Promise.all([
          axios.get<Release[]>(`${API}/releases/popular`, {
            params: { startDate, endDate, limit: 20 }
          }),
          axios.get<RecommendationResponse>(`${API}/releases/recommended`, {
            params: { limit: 20 }
          })
        ])
        setPopular(popRes.data)
        if (recRes.data.items.length) {
          setRecommended(recRes.data.items)
          setBaseTitle(recRes.data.base.title)
        }
      } catch (e) {
        console.error('Failed to load releases', e)
      }
    }
    fetchData()
  }, [])

  const updateButtons = (
    el: HTMLDivElement | null,
    setLeft: React.Dispatch<React.SetStateAction<boolean>>,
    setRight: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setLeft(scrollLeft > 0)
    setRight(scrollLeft + clientWidth < scrollWidth)
  }

  useEffect(() => {
    const el = popRef.current
    if (!el) return
    const onScroll = () => updateButtons(el, setPopLeft, setPopRight)
    onScroll()
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [popular])

  useEffect(() => {
    const el = recRef.current
    if (!el) return
    const onScroll = () => updateButtons(el, setRecLeft, setRecRight)
    onScroll()
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [recommended])

  const scrollPopularBy = (distance: number) => {
    if (popRef.current) popRef.current.scrollBy({ left: distance, behavior: 'smooth' })
  }

  const scrollRecommendedBy = (distance: number) => {
    if (recRef.current) recRef.current.scrollBy({ left: distance, behavior: 'smooth' })
  }

  return (
    <div className="bg-gray-900 text-gray-100 p-6 space-y-10">
      {/* Popular Now */}
      <div className="relative">
        <h1 className="text-2xl font-bold mb-4">Popular now</h1>
        {popLeft && (
          <button
            onClick={() => scrollPopularBy(-300)}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800/60 hover:bg-gray-800 p-2 rounded-full z-10"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <div ref={popRef} className="flex space-x-4 overflow-x-hidden scrollbar-hide">
          {popular.map((r) => {
            const url = r.posterPath
              ? `https://image.tmdb.org/t/p/w300${r.posterPath}`
              : '/placeholder.png'
            return (
              <div key={r.id} className="flex-shrink-0 w-40">
                <img
                  src={url}
                  alt={r.title}
                  className="w-full h-auto rounded-lg shadow-lg object-cover"
                />
              </div>
            )
          })}
        </div>
        {popRight && (
          <button
            onClick={() => scrollPopularBy(300)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800/60 hover:bg-gray-800 p-2 rounded-full z-10"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Recommended */}
      {recommended.length > 0 && (
        <div className="relative">
          <h2 className="text-2xl font-bold mb-4">
            Because you like <span className="italic">{baseTitle}</span>
          </h2>
          {recLeft && (
            <button
              onClick={() => scrollRecommendedBy(-300)}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800/60 hover:bg-gray-800 p-2 rounded-full z-10"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div ref={recRef} className="flex space-x-4 overflow-x-hidden scrollbar-hide">
            {recommended.map((r) => {
              const url = r.posterPath
                ? `https://image.tmdb.org/t/p/w300${r.posterPath}`
                : '/placeholder.png'
              return (
                <div key={r.id} className="flex-shrink-0 w-40">
                  <img
                    src={url}
                    alt={r.title}
                    className="w-full h-auto rounded-lg shadow-lg object-cover"
                  />
                </div>
              )
            })}
          </div>
          {recRight && (
            <button
              onClick={() => scrollRecommendedBy(300)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800/60 hover:bg-gray-800 p-2 rounded-full z-10"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
