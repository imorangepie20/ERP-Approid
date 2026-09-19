import { useState } from 'react'
import { Plus, MoreHorizontal, Calendar, Clock, User, MessageSquare, Paperclip, CheckSquare } from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'

interface Task {
    id: number
    title: string
    description?: string
    labels: string[]
    priority: 'low' | 'medium' | 'high'
    dueDate?: string
    comments: number
    attachments: number
    assignee?: string
}

interface Column {
    id: string
    title: string
    tasks: Task[]
}

const initialColumns: Column[] = [
    {
        id: 'todo',
        title: 'To Do',
        tasks: [
            { id: 1, title: 'Design new landing page', labels: ['Design'], priority: 'high', dueDate: 'Jan 20', comments: 3, attachments: 2 },
            { id: 2, title: 'Update user documentation', labels: ['Docs'], priority: 'medium', comments: 1, attachments: 0 },
            { id: 3, title: 'Fix login page responsive issues', labels: ['Bug', 'Frontend'], priority: 'high', comments: 5, attachments: 1 },
        ],
    },
    {
        id: 'inProgress',
        title: 'In Progress',
        tasks: [
            { id: 4, title: 'Implement API authentication', labels: ['Backend'], priority: 'high', dueDate: 'Jan 18', comments: 8, attachments: 3, assignee: 'JD' },
            { id: 5, title: 'Create dashboard widgets', labels: ['Frontend'], priority: 'medium', comments: 2, attachments: 0, assignee: 'AS' },
        ],
    },
    {
        id: 'review',
        title: 'In Review',
        tasks: [
            { id: 6, title: 'Database optimization', labels: ['Backend', 'Performance'], priority: 'medium', comments: 4, attachments: 2, assignee: 'BJ' },
        ],
    },
    {
        id: 'done',
        title: 'Done',
        tasks: [
            { id: 7, title: 'Setup CI/CD pipeline', labels: ['DevOps'], priority: 'low', comments: 6, attachments: 1, assignee: 'CW' },
            { id: 8, title: 'Create component library', labels: ['Frontend'], priority: 'medium', comments: 12, attachments: 5, assignee: 'JD' },
        ],
    },
]

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'high': return 'bg-hud-accent-danger'
        case 'medium': return 'bg-hud-accent-warning'
        default: return 'bg-hud-accent-success'
    }
}

const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
        'Design': 'bg-hud-accent-secondary/20 text-hud-accent-secondary',
        'Frontend': 'bg-hud-accent-primary/20 text-hud-accent-primary',
        'Backend': 'bg-hud-accent-info/20 text-hud-accent-info',
        'Bug': 'bg-hud-accent-danger/20 text-hud-accent-danger',
        'Docs': 'bg-hud-accent-warning/20 text-hud-accent-warning',
        'DevOps': 'bg-green-500/20 text-green-400',
        'Performance': 'bg-purple-500/20 text-purple-400',
    }
    return colors[label] || 'bg-hud-bg-hover text-hud-text-muted'
}

const ScrumBoard = () => {
    const [columns, setColumns] = useState(initialColumns)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Scrum Board</h1>
                    <p className="text-hud-text-muted mt-1">Manage your projects with drag and drop.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Plus size={18} />}>
                    Add Task
                </Button>
            </div>

            {/* Board Stats */}
            <div className="grid grid-cols-4 gap-4">
                {columns.map((col) => (
                    <div key={col.id} className="hud-card hud-card-bottom rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-hud-accent-primary font-mono">{col.tasks.length}</p>
                        <p className="text-xs text-hud-text-muted">{col.title}</p>
                    </div>
                ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {columns.map((column) => (
                    <div key={column.id} className="space-y-4">
                        {/* Column Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-hud-text-primary">{column.title}</h3>
                                <span className="px-2 py-0.5 bg-hud-bg-hover rounded text-xs text-hud-text-muted">
                                    {column.tasks.length}
                                </span>
                            </div>
                            <button className="p-1 text-hud-text-muted hover:text-hud-text-primary transition-hud">
                                <MoreHorizontal size={16} />
                            </button>
                        </div>

                        {/* Tasks */}
                        <div className="space-y-3">
                            {column.tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="hud-card hud-card-bottom rounded-lg p-4 cursor-pointer hover:border-hud-accent-primary transition-hud group"
                                >
                                    {/* Priority Indicator */}
                                    <div className={`w-full h-1 rounded-full ${getPriorityColor(task.priority)} mb-3`} />

                                    {/* Labels */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {task.labels.map((label) => (
                                            <span
                                                key={label}
                                                className={`px-2 py-0.5 rounded text-xs ${getLabelColor(label)}`}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Title */}
                                    <h4 className="text-sm font-medium text-hud-text-primary group-hover:text-hud-accent-primary transition-hud">
                                        {task.title}
                                    </h4>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-hud-border-secondary">
                                        <div className="flex items-center gap-3 text-xs text-hud-text-muted">
                                            {task.dueDate && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    <span>{task.dueDate}</span>
                                                </div>
                                            )}
                                            {task.comments > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <MessageSquare size={12} />
                                                    <span>{task.comments}</span>
                                                </div>
                                            )}
                                            {task.attachments > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Paperclip size={12} />
                                                    <span>{task.attachments}</span>
                                                </div>
                                            )}
                                        </div>
                                        {task.assignee && (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-info flex items-center justify-center text-xs text-hud-bg-primary font-medium">
                                                {task.assignee}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Task Button */}
                            <button className="w-full p-3 border-2 border-dashed border-hud-border-secondary rounded-lg text-sm text-hud-text-muted hover:border-hud-accent-primary hover:text-hud-accent-primary transition-hud flex items-center justify-center gap-2">
                                <Plus size={16} />
                                Add Task
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ScrumBoard
