import { Eye, EyeOff, Lock, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { safeReturnPath } from '../../auth/routes'
import Button from '../../components/common/Button'

const Login = () => {
    const [showPassword, setShowPassword] = useState(false)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<{ message: string; traceId?: string } | null>(null)
    const { login } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (pending) return
        setPending(true)
        setError(null)
        try {
            await login(username.trim(), password)
            navigate(safeReturnPath(location.state), { replace: true })
        } catch (cause) {
            setError(cause instanceof ApiError
                ? { message: cause.message, traceId: cause.traceId }
                : { message: '로그인 요청을 처리하지 못했습니다.' })
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-xl text-hud-bg-primary">
                            E
                        </div>
                        <span className="font-bold text-2xl text-hud-text-primary text-glow">ERP-Approid</span>
                    </div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">로그인</h1>
                    <p className="text-hud-text-muted mt-2">업무 시스템에 접속하려면 계정 정보를 입력하세요.</p>
                </div>

                <div className="hud-card hud-card-bottom rounded-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="username" className="block text-sm text-hud-text-secondary mb-2">
                                사용자명
                            </label>
                            <div className="relative">
                                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    id="username"
                                    name="username"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    value={username}
                                    onChange={event => setUsername(event.target.value)}
                                    placeholder="사용자명을 입력하세요"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm text-hud-text-secondary mb-2">
                                비밀번호
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    placeholder="비밀번호를 입력하세요"
                                    className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(current => !current)}
                                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div role="alert" className="rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 p-3 text-sm text-hud-accent-danger">
                                <p>{error.message}</p>
                                {error.traceId && <p className="mt-1 text-xs">추적 ID: {error.traceId}</p>}
                            </div>
                        )}

                        <Button variant="primary" fullWidth glow type="submit" disabled={pending}>
                            {pending ? '로그인 중...' : '로그인'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login
