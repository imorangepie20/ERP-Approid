import { useState } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Bell } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const UiModalNotification = () => {
    const [showModal, setShowModal] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [notifications, setNotifications] = useState<{ id: number; type: string; message: string }[]>([])

    const addNotification = (type: string, message: string) => {
        const id = Date.now()
        setNotifications(prev => [...prev, { id, type, message }])
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id))
        }, 5000)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Modals & Notifications</h1>
                <p className="text-hud-text-muted mt-1">Dialog boxes and toast notifications.</p>
            </div>

            {/* Notifications Container */}
            <div className="fixed top-20 right-6 z-50 space-y-3">
                {notifications.map((notif) => (
                    <div
                        key={notif.id}
                        className={`flex items-start gap-3 p-4 rounded-lg shadow-hud-glow animate-slide-in max-w-sm ${notif.type === 'success' ? 'bg-hud-accent-success/10 border border-hud-accent-success/30' :
                                notif.type === 'error' ? 'bg-hud-accent-danger/10 border border-hud-accent-danger/30' :
                                    notif.type === 'warning' ? 'bg-hud-accent-warning/10 border border-hud-accent-warning/30' :
                                        'bg-hud-accent-info/10 border border-hud-accent-info/30'
                            }`}
                    >
                        {notif.type === 'success' && <CheckCircle className="text-hud-accent-success shrink-0" size={20} />}
                        {notif.type === 'error' && <AlertCircle className="text-hud-accent-danger shrink-0" size={20} />}
                        {notif.type === 'warning' && <AlertTriangle className="text-hud-accent-warning shrink-0" size={20} />}
                        {notif.type === 'info' && <Info className="text-hud-accent-info shrink-0" size={20} />}
                        <div className="flex-1">
                            <p className="text-sm text-hud-text-primary">{notif.message}</p>
                        </div>
                        <button
                            onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                            className="text-hud-text-muted hover:text-hud-text-primary shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Modals Section */}
            <HudCard title="Modal Dialogs" subtitle="Click buttons to open modals">
                <div className="flex flex-wrap gap-3">
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                        Open Modal
                    </Button>
                    <Button variant="outline" onClick={() => setShowConfirm(true)}>
                        Confirm Dialog
                    </Button>
                </div>
            </HudCard>

            {/* Basic Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative hud-card hud-card-bottom rounded-lg w-full max-w-lg animate-fade-in">
                        <div className="flex items-center justify-between p-5 border-b border-hud-border-secondary">
                            <h3 className="text-lg font-semibold text-hud-text-primary">Modal Title</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-hud-text-secondary">
                                This is a basic modal dialog. You can put any content here including forms,
                                images, or any other components. The modal can be closed by clicking the X button
                                or clicking outside the modal.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-hud-border-secondary">
                            <Button variant="ghost" onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={() => setShowModal(false)}>
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
                    <div className="relative hud-card hud-card-bottom rounded-lg w-full max-w-sm animate-fade-in">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-hud-accent-danger/10 flex items-center justify-center">
                                <AlertTriangle size={32} className="text-hud-accent-danger" />
                            </div>
                            <h3 className="text-lg font-semibold text-hud-text-primary mb-2">Delete Item?</h3>
                            <p className="text-sm text-hud-text-secondary">
                                Are you sure you want to delete this item? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 p-5 border-t border-hud-border-secondary">
                            <Button variant="ghost" fullWidth onClick={() => setShowConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" fullWidth onClick={() => setShowConfirm(false)}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <HudCard title="Toast Notifications" subtitle="Click buttons to show notifications">
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="primary"
                        leftIcon={<CheckCircle size={16} />}
                        onClick={() => addNotification('success', 'Action completed successfully!')}
                    >
                        Success Toast
                    </Button>
                    <Button
                        variant="outline"
                        leftIcon={<Info size={16} />}
                        onClick={() => addNotification('info', 'Here is some useful information.')}
                    >
                        Info Toast
                    </Button>
                    <Button
                        variant="ghost"
                        leftIcon={<AlertTriangle size={16} />}
                        onClick={() => addNotification('warning', 'Please review your input carefully.')}
                    >
                        Warning Toast
                    </Button>
                    <Button
                        variant="danger"
                        leftIcon={<AlertCircle size={16} />}
                        onClick={() => addNotification('error', 'Something went wrong. Please try again.')}
                    >
                        Error Toast
                    </Button>
                </div>
            </HudCard>

            {/* Inline Alerts */}
            <HudCard title="Inline Alerts" subtitle="Contextual alert messages">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-hud-accent-success/10 border border-hud-accent-success/30">
                        <CheckCircle className="text-hud-accent-success shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-medium text-hud-accent-success">Success</h4>
                            <p className="text-sm text-hud-text-secondary mt-1">Your changes have been saved successfully.</p>
                        </div>
                        <button className="ml-auto text-hud-accent-success/50 hover:text-hud-accent-success shrink-0">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-hud-accent-info/10 border border-hud-accent-info/30">
                        <Info className="text-hud-accent-info shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-medium text-hud-accent-info">Information</h4>
                            <p className="text-sm text-hud-text-secondary mt-1">A new software update is available.</p>
                        </div>
                        <button className="ml-auto text-hud-accent-info/50 hover:text-hud-accent-info shrink-0">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-hud-accent-warning/10 border border-hud-accent-warning/30">
                        <AlertTriangle className="text-hud-accent-warning shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-medium text-hud-accent-warning">Warning</h4>
                            <p className="text-sm text-hud-text-secondary mt-1">Your subscription will expire in 3 days.</p>
                        </div>
                        <button className="ml-auto text-hud-accent-warning/50 hover:text-hud-accent-warning shrink-0">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-hud-accent-danger/10 border border-hud-accent-danger/30">
                        <AlertCircle className="text-hud-accent-danger shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-medium text-hud-accent-danger">Error</h4>
                            <p className="text-sm text-hud-text-secondary mt-1">Failed to upload file. Please try again.</p>
                        </div>
                        <button className="ml-auto text-hud-accent-danger/50 hover:text-hud-accent-danger shrink-0">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default UiModalNotification
