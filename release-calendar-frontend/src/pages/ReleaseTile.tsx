// components/ReleaseTile.tsx
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
import React from 'react'

export interface Genre { id: number; name: string }
export type RatingValue = 'LIKE' | 'DISLIKE' | null

export interface ReleaseDetails {
  id: number
  title: string
  releaseDate: string
  type: 'movie' | 'tv'
  posterPath: string | null
  genres: Genre[]
  watched: boolean
  rating: RatingValue
  overview: string
}

interface Props {
  release: ReleaseDetails
  onToggleWatched: (id: number) => void
  onSetRating: (id: number, r: RatingValue) => void
  onToggleTrack: (id: number) => void
  onClose: () => void
}

export default function ReleaseTile({
  release,
  onToggleWatched,
  onSetRating,
  onToggleTrack,
  onClose,
}: Props) {
  const posterUrl = release.posterPath
    ? `https://image.tmdb.org/t/p/w500${release.posterPath}`
    : null

  return (
    <div className="bg-gray-800 text-gray-100 rounded-xl shadow-lg overflow-hidden max-w-3xl w-full flex flex-col sm:flex-row">
      {/* CLOSE BUTTON */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-white"
      >
        ✕
      </button>

      {/* LEFT: Poster */}
      <div className="flex-shrink-0">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={release.title}
            className="w-full sm:w-48 h-auto object-cover"
          />
        ) : (
          <div className="w-full sm:w-48 bg-gray-700 flex items-center justify-center text-gray-400 h-64">
            No Image
          </div>
        )}
      </div>

      {/* MIDDLE: Details + Overview */}
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
            {release.genres.map((g) => g.name).join(', ')}
          </p>
          <h3 className="text-xl font-medium mt-4 mb-1">Overview</h3>
          <p className="text-gray-300 text-sm">{release.overview}</p>
        </div>
      </div>

      {/* RIGHT: Track / Like + Seen / Dislike */}
      <div className="self-center flex space-x-4 p-4">
        {/* Col 1: Track + Like */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={() => onToggleTrack(release.id)}
            className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
          >
            <FontAwesomeIcon
              icon={release.watched ? fasBookmarkSolid : farBookmarkRegular}
              className="h-8 w-8 text-white"
            />
            <span className="mt-1 text-xs text-white">Track</span>
          </button>
          {release.watched && (
            <button
              onClick={() => onSetRating(release.id, 'LIKE')}
              className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
            >
              <FontAwesomeIcon
                icon={release.rating === 'LIKE' ? fasThumbsUp : farThumbsUp}
                className={`h-8 w-8 ${
                  release.rating === 'LIKE' ? 'text-green-500' : 'text-white'
                }`}
              />
              <span className="mt-1 text-xs text-white">Like</span>
            </button>
          )}
        </div>

        {/* Col 2: Seen + Dislike */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={() => onToggleWatched(release.id)}
            className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
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
          {release.watched && (
            <button
              onClick={() => onSetRating(release.id, 'DISLIKE')}
              className="flex flex-col items-center justify-center bg-purple-primary p-2 rounded-lg focus:outline-none"
            >
              <FontAwesomeIcon
                icon={release.rating === 'DISLIKE' ? fasThumbsDown : farThumbsDown}
                className={`h-8 w-8 ${
                  release.rating === 'DISLIKE' ? 'text-red-500' : 'text-white'
                }`}
              />
              <span className="mt-1 text-xs text-white">Dislike</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
