import { useState } from 'react'
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    Users,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'

const events = [
    {
        id: 1,
        title: 'Team Standup',
        time: '09:00 AM',
        duration: '30 min',
        type: 'meeting',
        attendees: 8,
    },
    {
        id: 2,
        title: 'Client Presentation',
        time: '11:00 AM',
        duration: '1 hour',
        type: 'presentation',
        location: 'Conference Room A',
    },
    {
        id: 3,
        title: 'Lunch Break',
        time: '12:30 PM',
        duration: '1 hour',
        type: 'break',
    },
    {
        id: 4,
        title: 'Sprint Planning',
        time: '02:00 PM',
        duration: '2 hours',
        type: 'meeting',
        attendees: 12,
    },
    {
        id: 5,
        title: 'Code Review',
        time: '04:30 PM',
        duration: '1 hour',
        type: 'task',
    },
]

const upcomingEvents = [
    { date: '16', day: 'Thu', title: 'Product Launch', time: '10:00 AM' },
    { date: '17', day: 'Fri', title: 'Team Building', time: '02:00 PM' },
    { date: '20', day: 'Mon', title: 'Quarterly Review', time: '09:00 AM' },
    { date: '22', day: 'Wed', title: 'Training Session', time: '11:00 AM' },
]

const getEventColor = (type: string) => {
    switch (type) {
        case 'meeting':
            return 'bg-hud-accent-primary/10 border-hud-accent-primary text-hud-accent-primary'
        case 'presentation':
            return 'bg-hud-accent-info/10 border-hud-accent-info text-hud-accent-info'
        case 'task':
            return 'bg-hud-accent-warning/10 border-hud-accent-warning text-hud-accent-warning'
        default:
            return 'bg-hud-bg-hover border-hud-border-secondary text-hud-text-muted'
    }
}

const Calendar = () => {
    const [currentMonth] = useState('January 2026')
    const [selectedDate] = useState(15)

    // Generate calendar days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const calendarDays = Array.from({ length: 35 }, (_, i) => {
        const day = i - 3 // Offset for January 2026 starting on Thursday
        if (day < 1 || day > 31) return null
        return day
    })

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Calendar</h1>
                    <p className="text-hud-text-muted mt-1">Manage your schedule and events.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Plus size={18} />}>
                    Add Event
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <HudCard className="lg:col-span-2" noPadding>
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between p-4 border-b border-hud-border-secondary">
                        <button className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-hud-text-primary">{currentMonth}</h2>
                        <button className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Calendar */}
                    <div className="p-4">
                        {/* Days Header */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {days.map((day) => (
                                <div key={day} className="text-center text-xs font-medium text-hud-text-muted py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, i) => (
                                <div
                                    key={i}
                                    className={`aspect-square p-2 rounded-lg transition-hud ${day === null
                                            ? ''
                                            : day === selectedDate
                                                ? 'bg-hud-accent-primary text-hud-bg-primary font-semibold'
                                                : 'hover:bg-hud-bg-hover cursor-pointer'
                                        }`}
                                >
                                    {day && (
                                        <div className="text-center">
                                            <span className="text-sm">{day}</span>
                                            {/* Event indicators */}
                                            {(day === 15 || day === 16 || day === 20) && (
                                                <div className="flex justify-center gap-0.5 mt-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${day === selectedDate ? 'bg-hud-bg-primary' : 'bg-hud-accent-primary'}`} />
                                                    {day === 15 && (
                                                        <span className={`w-1.5 h-1.5 rounded-full ${day === selectedDate ? 'bg-hud-bg-primary' : 'bg-hud-accent-info'}`} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </HudCard>

                {/* Today's Events */}
                <div className="space-y-6">
                    <HudCard title="Today's Schedule" subtitle="January 15, 2026" noPadding>
                        <div className="divide-y divide-hud-border-secondary">
                            {events.map((event) => (
                                <div key={event.id} className="p-4 hover:bg-hud-bg-hover transition-hud cursor-pointer">
                                    <div className="flex gap-3">
                                        <div className={`w-1 rounded-full ${event.type === 'meeting' ? 'bg-hud-accent-primary' :
                                                event.type === 'presentation' ? 'bg-hud-accent-info' :
                                                    event.type === 'task' ? 'bg-hud-accent-warning' :
                                                        'bg-hud-text-muted'
                                            }`} />
                                        <div className="flex-1">
                                            <h4 className="text-sm font-medium text-hud-text-primary">{event.title}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="flex items-center gap-1 text-xs text-hud-text-muted">
                                                    <Clock size={12} />
                                                    <span>{event.time} • {event.duration}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                {event.location && (
                                                    <div className="flex items-center gap-1 text-xs text-hud-text-muted">
                                                        <MapPin size={12} />
                                                        <span>{event.location}</span>
                                                    </div>
                                                )}
                                                {event.attendees && (
                                                    <div className="flex items-center gap-1 text-xs text-hud-text-muted">
                                                        <Users size={12} />
                                                        <span>{event.attendees} attendees</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </HudCard>

                    <HudCard title="Upcoming Events" noPadding>
                        <div className="divide-y divide-hud-border-secondary">
                            {upcomingEvents.map((event, i) => (
                                <div key={i} className="p-4 hover:bg-hud-bg-hover transition-hud cursor-pointer flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-hud-accent-primary">{event.date}</p>
                                        <p className="text-xs text-hud-text-muted">{event.day}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-hud-text-primary">{event.title}</p>
                                        <p className="text-xs text-hud-text-muted">{event.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </HudCard>
                </div>
            </div>
        </div>
    )
}

export default Calendar
