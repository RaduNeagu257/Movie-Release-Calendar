import React, { useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { formatISO } from 'date-fns'

interface Release {
  id: number
  title: string
  releaseDate: string
  type: 'movie' | 'tv'
  genres: { tmdbId: number; name: string }[]
}

interface CalendarProps {
  onDateClick: (date: string) => void
  events: { title: string; date: string }[]
}

export const Calendar: React.FC<CalendarProps> = ({ onDateClick, events }) => {
  const calendarRef = useRef<FullCalendar>(null)

  return (
    <div className="p-4 bg-white rounded-2xl shadow">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={info => onDateClick(formatISO(info.date, { representation: 'date' }))}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
        height="auto"
      />
    </div>
  )
}
export default Calendar

