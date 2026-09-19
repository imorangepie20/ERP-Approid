import { useState, useEffect } from 'react'
import { Rocket, Clock, Bell, Mail } from 'lucide-react'
import Button from '../components/common/Button'

const ComingSoon = () => {
    const [timeLeft, setTimeLeft] = useState({
        days: 30,
        hours: 12,
        minutes: 45,
        seconds: 30,
    })

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                let { days, hours, minutes, seconds } = prev
                seconds--
                if (seconds < 0) {
                    seconds = 59
                    minutes--
                    if (minutes < 0) {
                        minutes = 59
                        hours--
                        if (hours < 0) {
                            hours = 23
                            days--
                            if (days < 0) {
                                days = 0
                                hours = 0
                                minutes = 0
                                seconds = 0
                            }
                        }
                    }
                }
                return { days, hours, minutes, seconds }
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="text-center max-w-2xl">
                {/* Icon */}
                <div className="mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20 rounded-full flex items-center justify-center">
                        <Rocket size={48} className="text-hud-accent-primary animate-bounce" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-bold text-hud-text-primary mb-4">
                    Coming Soon
                </h1>
                <p className="text-lg text-hud-text-secondary max-w-md mx-auto mb-12">
                    We're working hard to bring you something amazing. Stay tuned for the launch!
                </p>

                {/* Countdown */}
                <div className="grid grid-cols-4 gap-4 max-w-md mx-auto mb-12">
                    {[
                        { label: 'Days', value: timeLeft.days },
                        { label: 'Hours', value: timeLeft.hours },
                        { label: 'Minutes', value: timeLeft.minutes },
                        { label: 'Seconds', value: timeLeft.seconds },
                    ].map((item) => (
                        <div key={item.label} className="hud-card hud-card-bottom rounded-lg p-4">
                            <div className="text-3xl md:text-4xl font-bold text-hud-accent-primary font-mono">
                                {String(item.value).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-hud-text-muted mt-1">{item.label}</div>
                        </div>
                    ))}
                </div>

                {/* Newsletter */}
                <div className="max-w-md mx-auto">
                    <p className="text-sm text-hud-text-muted mb-4 flex items-center justify-center gap-2">
                        <Bell size={16} className="text-hud-accent-primary" />
                        Get notified when we launch
                    </p>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="w-full pl-11 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                        <Button variant="primary" glow>
                            Notify Me
                        </Button>
                    </div>
                </div>

                {/* Progress */}
                <div className="mt-12 max-w-md mx-auto">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-hud-text-muted">Development Progress</span>
                        <span className="text-hud-accent-primary font-mono">75%</span>
                    </div>
                    <div className="h-2 bg-hud-bg-secondary rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full" />
                    </div>
                </div>

                {/* Features Preview */}
                <div className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {['Dashboard', 'Analytics', 'AI Studio'].map((feature) => (
                        <div key={feature} className="p-4 bg-hud-bg-secondary/50 rounded-lg border border-hud-border-secondary">
                            <div className="w-8 h-8 mx-auto mb-2 bg-hud-accent-primary/10 rounded-lg flex items-center justify-center">
                                <Clock size={16} className="text-hud-accent-primary" />
                            </div>
                            <span className="text-xs text-hud-text-muted">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ComingSoon
