import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Send,
    Paperclip,
    Image,
    Link as LinkIcon,
    Smile,
    Bold,
    Italic,
    List,
    ListOrdered,
    X,
    ArrowLeft,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const EmailCompose = () => {
    const navigate = useNavigate()
    const [to, setTo] = useState('')
    const [cc, setCc] = useState('')
    const [subject, setSubject] = useState('')
    const [content, setContent] = useState('')
    const [attachments, setAttachments] = useState<string[]>([])
    const [showCc, setShowCc] = useState(false)

    const handleSend = () => {
        // Simulate sending
        alert('Email sent successfully!')
        navigate('/email/inbox')
    }

    const handleAttach = () => {
        // Simulate attachment
        setAttachments([...attachments, `document_${attachments.length + 1}.pdf`])
    }

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    to="/email/inbox"
                    className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Compose Email</h1>
                    <p className="text-hud-text-muted mt-1">Create and send a new email.</p>
                </div>
            </div>

            <HudCard>
                {/* Recipients */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="w-12 text-sm text-hud-text-muted">To:</label>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                placeholder="recipient@email.com"
                                className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                        {!showCc && (
                            <button
                                onClick={() => setShowCc(true)}
                                className="text-sm text-hud-accent-primary hover:underline"
                            >
                                Cc
                            </button>
                        )}
                    </div>

                    {showCc && (
                        <div className="flex items-center gap-4">
                            <label className="w-12 text-sm text-hud-text-muted">Cc:</label>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={cc}
                                    onChange={(e) => setCc(e.target.value)}
                                    placeholder="cc@email.com"
                                    className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                            <button
                                onClick={() => setShowCc(false)}
                                className="p-1 text-hud-text-muted hover:text-hud-accent-danger transition-hud"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        <label className="w-12 text-sm text-hud-text-muted">Subject:</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject"
                            className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-hud-border-secondary my-6" />

                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 mb-4 pb-4 border-b border-hud-border-secondary">
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <Bold size={16} />
                    </button>
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <Italic size={16} />
                    </button>
                    <div className="w-px h-5 bg-hud-border-secondary mx-1" />
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <List size={16} />
                    </button>
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <ListOrdered size={16} />
                    </button>
                    <div className="w-px h-5 bg-hud-border-secondary mx-1" />
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <LinkIcon size={16} />
                    </button>
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <Image size={16} />
                    </button>
                    <button className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                        <Smile size={16} />
                    </button>
                </div>

                {/* Content */}
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your message here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                />

                {/* Attachments */}
                {attachments.length > 0 && (
                    <div className="mt-4 p-4 bg-hud-bg-primary rounded-lg border border-hud-border-secondary">
                        <p className="text-sm text-hud-text-muted mb-3">Attachments ({attachments.length})</p>
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((file, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-3 py-2 bg-hud-bg-secondary rounded-lg border border-hud-border-secondary"
                                >
                                    <Paperclip size={14} className="text-hud-accent-primary" />
                                    <span className="text-sm text-hud-text-primary">{file}</span>
                                    <button
                                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                                        className="p-0.5 hover:text-hud-accent-danger transition-hud"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Paperclip size={16} />}
                            onClick={handleAttach}
                        >
                            Attach File
                        </Button>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => navigate('/email/inbox')}>
                            Discard
                        </Button>
                        <Button
                            variant="primary"
                            glow
                            leftIcon={<Send size={16} />}
                            onClick={handleSend}
                        >
                            Send Email
                        </Button>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default EmailCompose
