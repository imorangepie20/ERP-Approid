import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search, AlertTriangle } from 'lucide-react'
import Button from '../components/common/Button'

const Error404 = () => {
    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="text-center max-w-lg">
                {/* 404 Animation */}
                <div className="relative mb-8">
                    <div className="text-[150px] md:text-[200px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-br from-hud-accent-primary via-hud-accent-info to-hud-accent-secondary animate-pulse">
                        404
                    </div>
                    <div className="absolute inset-0 text-[150px] md:text-[200px] font-bold leading-none text-hud-accent-primary/10 blur-xl">
                        404
                    </div>
                </div>

                {/* Message */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-hud-text-primary mb-4">
                        Page Not Found
                    </h1>
                    <p className="text-hud-text-secondary max-w-md mx-auto">
                        Oops! The page you're looking for doesn't exist or has been moved.
                        Please check the URL or navigate back to the homepage.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/">
                        <Button variant="primary" glow leftIcon={<Home size={18} />}>
                            Go to Homepage
                        </Button>
                    </Link>
                    <Button variant="outline" leftIcon={<ArrowLeft size={18} />} onClick={() => window.history.back()}>
                        Go Back
                    </Button>
                </div>

                {/* Search */}
                <div className="mt-8">
                    <p className="text-sm text-hud-text-muted mb-3">Or try searching:</p>
                    <div className="relative max-w-sm mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search for pages..."
                            className="w-full pl-11 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>

                {/* Quick Links */}
                <div className="mt-8 pt-8 border-t border-hud-border-secondary">
                    <p className="text-sm text-hud-text-muted mb-4">Popular pages:</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {[
                            { label: 'Dashboard', path: '/' },
                            { label: 'Analytics', path: '/analytics' },
                            { label: 'Settings', path: '/settings' },
                            { label: 'Profile', path: '/profile' },
                        ].map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className="px-4 py-2 bg-hud-bg-secondary rounded-lg text-sm text-hud-text-secondary hover:text-hud-accent-primary hover:bg-hud-bg-hover transition-hud"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Error404
