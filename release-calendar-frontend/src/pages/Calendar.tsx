import React, { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

interface CalendarProps {
  events: { title: string; date: string }[]
  onDateClick: (date: string) => void
}

const Calendar: React.FC<CalendarProps> = ({ events, onDateClick }) => {
  const calendarRef = useRef<FullCalendar | null>(null)
  const router = useRouter()

  return (
    <div className="p-4 bg-gray-panel border border-gray-700 rounded-2xl shadow-inner">
      <FullCalendar
        ref={calendarRef}

        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={info => onDateClick(info.dateStr)}
        eventColor="#7e22ce" // purple-700
        headerToolbar={{
          left: 'prev,next myToday',
          center: 'title',
          right: ''
        }}

        customButtons={{
          myToday: {
            text: 'today',
            click: () => {
              // safe‐guard against null
              const calendarApi = calendarRef.current?.getApi()
              if (!calendarApi) return

              // jump the view to today
              calendarApi.today()

              // tell your React state about today, so the sidebar updates
              const todayStr = new Date().toISOString().split('T')[0]
              onDateClick(todayStr)
            }
          }
        }}
        dayHeaderContent={d => (
          <span className="text-gray-400 dark:text-gray-500">{d.text}</span>
        )}
        height="auto"
      />
    </div>
  )
}
export default Calendar
