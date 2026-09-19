import { useState } from 'react'
import { Calendar, Clock, Users, Plus, Search, Filter } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const timeSlots = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']

const tables = [
    { id: 1, name: 'Table 1', capacity: 2, status: 'available' },
    { id: 2, name: 'Table 2', capacity: 2, status: 'reserved' },
    { id: 3, name: 'Table 3', capacity: 4, status: 'occupied' },
    { id: 4, name: 'Table 4', capacity: 4, status: 'available' },
    { id: 5, name: 'Table 5', capacity: 6, status: 'reserved' },
    { id: 6, name: 'Table 6', capacity: 6, status: 'available' },
    { id: 7, name: 'Table 7', capacity: 8, status: 'available' },
    { id: 8, name: 'Table 8', capacity: 4, status: 'occupied' },
    { id: 9, name: 'VIP 1', capacity: 10, status: 'available' },
    { id: 10, name: 'VIP 2', capacity: 12, status: 'reserved' },
]

const reservations = [
    { id: 1, name: 'John Smith', table: 'Table 2', time: '12:00', guests: 2, phone: '+1 555-1234' },
    { id: 2, name: 'Emma Wilson', table: 'Table 5', time: '19:00', guests: 5, phone: '+1 555-5678' },
    { id: 3, name: 'Corporate Event', table: 'VIP 2', time: '18:30', guests: 10, phone: '+1 555-9012' },
]

const getStatusColor = (status: string) => {
    switch (status) {
        case 'available':
            return 'bg-hud-accent-success/10 border-hud-accent-success text-hud-accent-success'
        case 'reserved':
            return 'bg-hud-accent-warning/10 border-hud-accent-warning text-hud-accent-warning'
        case 'occupied':
            return 'bg-hud-accent-danger/10 border-hud-accent-danger text-hud-accent-danger'
        default:
            return 'bg-hud-bg-hover border-hud-border-secondary text-hud-text-muted'
    }
}

const PosTableBooking = () => {
    const [selectedDate, setSelectedDate] = useState('2026-01-15')
    const [selectedTable, setSelectedTable] = useState<number | null>(null)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Table Booking</h1>
                    <p className="text-hud-text-muted mt-1">Manage reservations and table availability.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Plus size={18} />}>
                    New Reservation
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table Map */}
                <div className="lg:col-span-2">
                    <HudCard title="Floor Plan" subtitle="Click on a table to view details">
                        {/* Legend */}
                        <div className="flex gap-4 mb-6">
                            {['available', 'reserved', 'occupied'].map((status) => (
                                <div key={status} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${status === 'available' ? 'bg-hud-accent-success' :
                                            status === 'reserved' ? 'bg-hud-accent-warning' :
                                                'bg-hud-accent-danger'
                                        }`} />
                                    <span className="text-xs text-hud-text-secondary capitalize">{status}</span>
                                </div>
                            ))}
                        </div>

                        {/* Table Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {tables.map((table) => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTable(table.id)}
                                    className={`p-4 rounded-lg border-2 transition-all ${getStatusColor(table.status)} ${selectedTable === table.id ? 'ring-2 ring-hud-accent-primary ring-offset-2 ring-offset-hud-bg-secondary' : ''
                                        } hover:scale-105`}
                                >
                                    <div className="text-center">
                                        <p className="font-semibold">{table.name}</p>
                                        <div className="flex items-center justify-center gap-1 mt-1 text-xs opacity-80">
                                            <Users size={12} />
                                            <span>{table.capacity}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-hud-border-secondary">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-hud-accent-success font-mono">
                                    {tables.filter(t => t.status === 'available').length}
                                </p>
                                <p className="text-xs text-hud-text-muted">Available</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-hud-accent-warning font-mono">
                                    {tables.filter(t => t.status === 'reserved').length}
                                </p>
                                <p className="text-xs text-hud-text-muted">Reserved</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-hud-accent-danger font-mono">
                                    {tables.filter(t => t.status === 'occupied').length}
                                </p>
                                <p className="text-xs text-hud-text-muted">Occupied</p>
                            </div>
                        </div>
                    </HudCard>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Date Picker */}
                    <HudCard>
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar size={20} className="text-hud-accent-primary" />
                            <span className="font-semibold text-hud-text-primary">Select Date</span>
                        </div>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </HudCard>

                    {/* Time Slots */}
                    <HudCard title="Available Times">
                        <div className="grid grid-cols-4 gap-2">
                            {timeSlots.map((time) => (
                                <button
                                    key={time}
                                    className="py-2 px-1 text-xs rounded bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-accent-primary hover:text-hud-bg-primary transition-hud"
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </HudCard>

                    {/* Today's Reservations */}
                    <HudCard title="Today's Reservations" noPadding>
                        <div className="divide-y divide-hud-border-secondary">
                            {reservations.map((res) => (
                                <div key={res.id} className="p-4 hover:bg-hud-bg-hover transition-hud">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-hud-text-primary">{res.name}</span>
                                        <span className="text-xs text-hud-accent-primary">{res.table}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-hud-text-muted">
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            <span>{res.time}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users size={12} />
                                            <span>{res.guests} guests</span>
                                        </div>
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

export default PosTableBooking
