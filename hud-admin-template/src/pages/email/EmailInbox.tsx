import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Inbox,
    Send,
    Star,
    Trash2,
    Archive,
    AlertCircle,
    Tag,
    Mail,
    MailOpen,
    Paperclip,
    Search,
    RefreshCw,
    MoreVertical,
    ChevronDown,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const folders = [
    { name: 'Inbox', icon: <Inbox size={18} />, count: 24 },
    { name: 'Sent', icon: <Send size={18} />, count: 0 },
    { name: 'Starred', icon: <Star size={18} />, count: 5 },
    { name: 'Drafts', icon: <Mail size={18} />, count: 2 },
    { name: 'Archive', icon: <Archive size={18} />, count: 0 },
    { name: 'Spam', icon: <AlertCircle size={18} />, count: 3 },
    { name: 'Trash', icon: <Trash2 size={18} />, count: 0 },
]

const labels = [
    { name: 'Work', color: '#00FFCC' },
    { name: 'Personal', color: '#6366F1' },
    { name: 'Important', color: '#FF1493' },
    { name: 'Updates', color: '#FFA500' },
]

const emails = [
    {
        id: 1,
        from: 'John Doe',
        email: 'john.doe@company.com',
        subject: 'Project Update - Q4 Report Ready',
        preview: 'Hi, I wanted to let you know that the Q4 report is now ready for review. Please take a look when you have a chance...',
        time: '10:30 AM',
        isRead: false,
        isStarred: true,
        hasAttachment: true,
        label: 'Work',
    },
    {
        id: 2,
        from: 'Sarah Connor',
        email: 'sarah@techcorp.io',
        subject: 'Meeting Scheduled for Tomorrow',
        preview: 'Just a reminder that we have a meeting scheduled for tomorrow at 2 PM. Please prepare the presentation slides...',
        time: '9:45 AM',
        isRead: false,
        isStarred: false,
        hasAttachment: false,
        label: 'Important',
    },
    {
        id: 3,
        from: 'GitHub',
        email: 'noreply@github.com',
        subject: '[GitHub] Security Alert: New sign-in detected',
        preview: 'We detected a new sign-in to your GitHub account from a new device. If this was you, no action is needed...',
        time: 'Yesterday',
        isRead: true,
        isStarred: false,
        hasAttachment: false,
        label: 'Updates',
    },
    {
        id: 4,
        from: 'Marketing Team',
        email: 'marketing@company.com',
        subject: 'New Campaign Launch - Action Required',
        preview: 'The new marketing campaign is ready to launch. We need your approval on the final assets before we go live...',
        time: 'Yesterday',
        isRead: true,
        isStarred: true,
        hasAttachment: true,
        label: 'Work',
    },
    {
        id: 5,
        from: 'Amazon',
        email: 'ship-confirm@amazon.com',
        subject: 'Your package has been delivered',
        preview: 'Your Amazon package has been delivered. Track your delivery and manage orders on Amazon.com...',
        time: 'Jan 12',
        isRead: true,
        isStarred: false,
        hasAttachment: false,
        label: 'Personal',
    },
    {
        id: 6,
        from: 'Design Team',
        email: 'design@company.com',
        subject: 'New UI Components Ready for Review',
        preview: 'The design team has completed the new UI components. Please review them in Figma and provide feedback...',
        time: 'Jan 11',
        isRead: true,
        isStarred: false,
        hasAttachment: true,
        label: 'Work',
    },
    {
        id: 7,
        from: 'LinkedIn',
        email: 'messages@linkedin.com',
        subject: 'You have 3 new connection requests',
        preview: 'Check out who wants to connect with you on LinkedIn. Expand your network and discover new opportunities...',
        time: 'Jan 10',
        isRead: true,
        isStarred: false,
        hasAttachment: false,
        label: 'Updates',
    },
]

const getLabelColor = (labelName: string) => {
    const label = labels.find(l => l.name === labelName)
    return label?.color || '#A0AEC0'
}

const EmailInbox = () => {
    const [selectedFolder, setSelectedFolder] = useState('Inbox')
    const [selectedEmails, setSelectedEmails] = useState<number[]>([])

    const toggleEmailSelection = (id: number) => {
        setSelectedEmails(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedEmails.length === emails.length) {
            setSelectedEmails([])
        } else {
            setSelectedEmails(emails.map(e => e.id))
        }
    }

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Inbox</h1>
                    <p className="text-hud-text-muted mt-1">Manage your email communications.</p>
                </div>
                <Link to="/email/compose">
                    <Button variant="primary" glow leftIcon={<Mail size={18} />}>
                        Compose
                    </Button>
                </Link>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0 space-y-6">
                    {/* Folders */}
                    <HudCard noPadding>
                        <div className="py-2">
                            {folders.map((folder) => (
                                <button
                                    key={folder.name}
                                    onClick={() => setSelectedFolder(folder.name)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-hud ${selectedFolder === folder.name
                                            ? 'bg-hud-accent-primary/10 text-hud-accent-primary'
                                            : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {folder.icon}
                                        <span className="text-sm">{folder.name}</span>
                                    </div>
                                    {folder.count > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedFolder === folder.name
                                                ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                : 'bg-hud-bg-hover text-hud-text-muted'
                                            }`}>
                                            {folder.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </HudCard>

                    {/* Labels */}
                    <HudCard title="Labels" noPadding>
                        <div className="py-2">
                            {labels.map((label) => (
                                <button
                                    key={label.name}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary transition-hud"
                                >
                                    <Tag size={16} style={{ color: label.color }} />
                                    <span className="text-sm">{label.name}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                {/* Email List */}
                <div className="flex-1">
                    <HudCard noPadding>
                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border-secondary">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedEmails.length === emails.length && emails.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                />
                                <button className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                                    <RefreshCw size={16} />
                                </button>
                                <button className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                                    <Archive size={16} />
                                </button>
                                <button className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-accent-danger transition-hud">
                                    <Trash2 size={16} />
                                </button>
                                <button className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                                    <MoreVertical size={16} />
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search emails..."
                                    className="w-64 pl-9 pr-4 py-1.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        {/* Email Items */}
                        <div className="divide-y divide-hud-border-secondary">
                            {emails.map((email) => (
                                <Link
                                    key={email.id}
                                    to={`/email/detail/${email.id}`}
                                    className={`flex items-center gap-4 px-4 py-3 hover:bg-hud-bg-hover transition-hud ${!email.isRead ? 'bg-hud-accent-primary/5' : ''
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEmails.includes(email.id)}
                                        onChange={(e) => {
                                            e.preventDefault()
                                            toggleEmailSelection(email.id)
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                    />

                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        className={`p-1 transition-hud ${email.isStarred ? 'text-hud-accent-warning' : 'text-hud-text-muted hover:text-hud-accent-warning'}`}
                                    >
                                        <Star size={16} fill={email.isStarred ? 'currentColor' : 'none'} />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm ${!email.isRead ? 'font-semibold text-hud-text-primary' : 'text-hud-text-secondary'}`}>
                                                {email.from}
                                            </span>
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getLabelColor(email.label) }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {!email.isRead ? (
                                                <Mail size={14} className="text-hud-accent-primary flex-shrink-0" />
                                            ) : (
                                                <MailOpen size={14} className="text-hud-text-muted flex-shrink-0" />
                                            )}
                                            <span className={`text-sm truncate ${!email.isRead ? 'font-medium text-hud-text-primary' : 'text-hud-text-secondary'}`}>
                                                {email.subject}
                                            </span>
                                            {email.hasAttachment && (
                                                <Paperclip size={14} className="text-hud-text-muted flex-shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-xs text-hud-text-muted mt-1 truncate">{email.preview}</p>
                                    </div>

                                    <span className="text-xs text-hud-text-muted whitespace-nowrap">{email.time}</span>
                                </Link>
                            ))}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-hud-border-secondary">
                            <span className="text-sm text-hud-text-muted">Showing 1-7 of 24 emails</span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" disabled>Previous</Button>
                                <Button variant="ghost" size="sm">Next</Button>
                            </div>
                        </div>
                    </HudCard>
                </div>
            </div>
        </div>
    )
}

export default EmailInbox
