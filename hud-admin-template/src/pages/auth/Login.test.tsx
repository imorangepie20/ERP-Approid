import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../../auth/AuthContext'
import { PublicOnly } from '../../auth/RouteGuards'
import Login from './Login'

const env = {
    VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
}

function renderLogin(fetchMock: typeof fetch) {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <AuthProvider env={env} storage={sessionStorage} fetch={fetchMock}>
                <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/sales/orders' } }]}>
                    <Routes>
                        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                        <Route path="/sales/orders" element={<div>수주 현황</div>} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>,
    )
}

describe('Login', () => {
    beforeEach(() => sessionStorage.clear())

    it('submits username/password and returns to the intended internal route', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
            accessToken: 'token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: { id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] },
        }))
        renderLogin(fetchMock)

        await user.type(screen.getByLabelText('사용자명'), 'admin')
        await user.type(screen.getByLabelText('비밀번호'), 'password')
        await user.click(screen.getByRole('button', { name: '로그인' }))

        expect(await screen.findByText('수주 현황')).toBeInTheDocument()
    })

    it('shows a safe API error and trace ID without unsupported login controls', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            code: 'UNAUTHORIZED',
            message: '아이디 또는 비밀번호를 확인해 주세요.',
            traceId: 'trace-login',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
        renderLogin(fetchMock)

        expect(screen.queryByText(/Google|회원가입|비밀번호 찾기/)).not.toBeInTheDocument()
        await user.type(screen.getByLabelText('사용자명'), 'admin')
        await user.type(screen.getByLabelText('비밀번호'), 'wrong')
        await user.click(screen.getByRole('button', { name: '로그인' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('아이디 또는 비밀번호를 확인해 주세요.')
        expect(screen.getByText(/trace-login/)).toBeInTheDocument()
    })
})
