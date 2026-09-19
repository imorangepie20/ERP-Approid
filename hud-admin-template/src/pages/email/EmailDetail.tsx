import { Link, useParams } from 'react-router-dom'
import {
    ArrowLeft,
    Reply,
    ReplyAll,
    Forward,
    Star,
    Trash2,
    Archive,
    Printer,
    MoreVertical,
    Paperclip,
    Download,
    Clock,
    Tag,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

// Sample email data
const emailData = {
    id: 1,
    from: {
        name: 'John Doe',
        email: 'john.doe@company.com',
        avatar: 'JD',
    },
    to: 'admin@hudadmin.com',
    subject: 'Project Update - Q4 Report Ready',
    date: 'January 15, 2026 at 10:30 AM',
    isStarred: true,
    label: 'Work',
    attachments: [
        { name: 'Q4_Report_2025.pdf', size: '2.4 MB' },
        { name: 'Financial_Summary.xlsx', size: '856 KB' },
    ],
    content: `
    <p>Hi Team,</p>
    
    <p>I hope this email finds you well. I wanted to let you know that the Q4 report is now ready for review.</p>
    
    <p>Here are the key highlights:</p>
    
    <ul>
      <li>Revenue increased by 23% compared to Q3</li>
      <li>Customer acquisition cost reduced by 15%</li>
      <li>User engagement metrics showed significant improvement</li>
      <li>New product launches exceeded expectations</li>
    </ul>
    
    <p>Please review the attached documents and let me know if you have any questions or need any clarifications.</p>
    
    <p>I've also included the financial summary spreadsheet for your reference.</p>
    
    <p>Looking forward to discussing this in our next meeting.</p>
    
    <p>Best regards,<br/>John Doe<br/>Senior Project Manager</p>
  `,
}

const EmailDetail = () => {
    const { id } = useParams()

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link
                        to="/email/inbox"
                        className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-hud-text-primary">{emailData.subject}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5 text-sm text-hud-text-muted">
                                <Clock size={14} />
                                <span>{emailData.date}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                                <Tag size={14} className="text-hud-accent-primary" />
                                <span className="text-hud-accent-primary">{emailData.label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className={`p-2 rounded-lg transition-hud ${emailData.isStarred ? 'text-hud-accent-warning' : 'text-hud-text-muted hover:text-hud-accent-warning'}`}>
                        <Star size={20} fill={emailData.isStarred ? 'currentColor' : 'none'} />
                    </button>
                    <button className="p-2 rounded-lg text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud">
                        <Archive size={20} />
                    </button>
                    <button className="p-2 rounded-lg text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-bg-hover transition-hud">
                        <Trash2 size={20} />
                    </button>
                    <button className="p-2 rounded-lg text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud">
                        <Printer size={20} />
                    </button>
                    <button className="p-2 rounded-lg text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Email Content */}
            <HudCard>
                {/* Sender Info */}
                <div className="flex items-start justify-between pb-4 border-b border-hud-border-secondary">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-info flex items-center justify-center text-hud-bg-primary font-semibold">
                            {emailData.from.avatar}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-hud-text-primary">{emailData.from.name}</span>
                                <span className="text-sm text-hud-text-muted">{'<'}{emailData.from.email}{'>'}</span>
                            </div>
                            <p className="text-sm text-hud-text-muted mt-0.5">
                                To: <span className="text-hud-text-secondary">{emailData.to}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Email Body */}
                <div
                    className="py-6 prose prose-invert max-w-none
            [&_p]:text-hud-text-primary [&_p]:mb-4 [&_p]:leading-relaxed
            [&_ul]:text-hud-text-primary [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6
            [&_li]:mb-2
          "
                    dangerouslySetInnerHTML={{ __html: emailData.content }}
                />

                {/* Attachments */}
                {emailData.attachments.length > 0 && (
                    <div className="pt-4 border-t border-hud-border-secondary">
                        <p className="text-sm text-hud-text-muted mb-3 flex items-center gap-2">
                            <Paperclip size={16} />
                            {emailData.attachments.length} Attachments
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {emailData.attachments.map((file, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-hud-bg-primary rounded-lg border border-hud-border-secondary hover:border-hud-accent-primary transition-hud cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-hud-accent-primary/10 flex items-center justify-center text-hud-accent-primary">
                                            <Paperclip size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm text-hud-text-primary">{file.name}</p>
                                            <p className="text-xs text-hud-text-muted">{file.size}</p>
                                        </div>
                                    </div>
                                    <button className="p-2 rounded-lg text-hud-text-muted group-hover:text-hud-accent-primary transition-hud">
                                        <Download size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-6 mt-4 border-t border-hud-border-secondary">
                    <Button variant="outline" leftIcon={<Reply size={16} />}>
                        Reply
                    </Button>
                    <Button variant="ghost" leftIcon={<ReplyAll size={16} />}>
                        Reply All
                    </Button>
                    <Button variant="ghost" leftIcon={<Forward size={16} />}>
                        Forward
                    </Button>
                </div>
            </HudCard>
        </div>
    )
}

export default EmailDetail
