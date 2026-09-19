import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Button from '../../components/common/Button'

const Login = () => {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-xl text-hud-bg-primary">
                            H
                        </div>
                        <span className="font-bold text-2xl text-hud-text-primary text-glow">ALPHA TEAM</span>
                    </div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Welcome Back</h1>
                    <p className="text-hud-text-muted mt-2">Sign in to your account to continue</p>
                </div>

                {/* Login Form */}
                <div className="hud-card hud-card-bottom rounded-lg p-8">
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember & Forgot */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                />
                                <span className="text-sm text-hud-text-secondary">Remember me</span>
                            </label>
                            <a href="#" className="text-sm text-hud-accent-primary hover:underline">
                                Forgot password?
                            </a>
                        </div>

                        {/* Submit */}
                        <Button variant="primary" fullWidth glow type="submit">
                            Sign In
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-hud-border-secondary"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-hud-bg-card text-sm text-hud-text-muted">or continue with</span>
                        </div>
                    </div>

                    {/* Social Login */}
                    <div className="grid grid-cols-3 gap-3">
                        {['Google', 'GitHub', 'Twitter'].map((provider) => (
                            <button
                                key={provider}
                                className="py-2.5 px-4 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-secondary hover:border-hud-accent-primary hover:text-hud-accent-primary transition-hud"
                            >
                                {provider}
                            </button>
                        ))}
                    </div>

                    {/* Register Link */}
                    <p className="text-center text-sm text-hud-text-muted mt-6">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-hud-accent-primary hover:underline">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
