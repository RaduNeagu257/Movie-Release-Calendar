import React, { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

interface CalendarProps {
  events: { title: string; date: string }[]
  onDateClick: (date: string) => void
}

const Calendar: React.FC<CalendarProps> = ({ events, onDateClick }) => {
  // 1) Create the ref, initially null
  const calendarRef = useRef<FullCalendar | null>(null)

  return (
    <div className="p-4 bg-white rounded-2xl shadow">
      <FullCalendar
        // 2) Attach the ref here
        ref={calendarRef}

        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}

        dateClick={info => onDateClick(info.dateStr)}

        headerToolbar={{
          left: 'prev,next myToday',  // drop the built-in 'today'
          center: 'title',
          right: ''
        }}

        // 3) Define a custom 'myToday' button that both moves the view AND fires your callback
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

        height="auto"
      />
    </div>
  )
}

export default Calendar
