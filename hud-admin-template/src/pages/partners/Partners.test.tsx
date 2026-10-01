import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthContext'
import { saveSession } from '../../auth/session'
import Partners from './Partners'

const partner = { id: 11, partnerNo: 'C-LIVE', name: '실거래처', contactName: '김담당',
    contact: '02-111-2222', partnerType: '고객사', paymentTerms: 45, leadTimeDays: 7 }
const env = { VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics' }

function renderPartners(handler: (url: URL, init?: RequestInit) => Response, roles = ['ADMIN']) {
    saveSession(sessionStorage, 'token', 3600)
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/auth/me')) return Response.json({ id: 1, username: 'user', name: '사용자', roles })
        return handler(url, init)
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider env={env} fetch={fetchMock}><Partners /></AuthProvider>
    </QueryClientProvider>)
    return fetchMock
}

function page(content = [partner]) {
    return Response.json({ content, number: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0 })
}

describe('Partners', () => {
    beforeEach(() => sessionStorage.clear())

    it('shows server data and sends the partner type filter', async () => {
        const requests = renderPartners(() => page())
        expect(await screen.findByText('C-LIVE')).toBeInTheDocument()
        expect(screen.getByText('김담당')).toBeInTheDocument()
        await userEvent.selectOptions(screen.getByLabelText('거래처 유형'), '발주처')
        await waitFor(() => expect(requests.mock.calls.some(([url]) => String(url).includes('partnerType='))).toBe(true))
        expect(new URL(String(requests.mock.calls[requests.mock.calls.length - 1][0])).searchParams.get('partnerType')).toBe('발주처')
    })

    it('creates a partner with payment terms and lead time then refreshes the list', async () => {
        const user = userEvent.setup()
        let created: Record<string, unknown> | undefined
        renderPartners((_url, init) => {
            if (init?.method === 'POST') {
                created = JSON.parse(String(init.body))
                return Response.json({ ...partner, ...created }, { status: 201 })
            }
            return page()
        })
        await user.click(await screen.findByRole('button', { name: '거래처 등록' }))
        const dialog = within(screen.getByRole('dialog'))
        await user.type(dialog.getByLabelText('거래처 코드 *'), 'V-NEW')
        await user.type(dialog.getByLabelText('거래처명 *'), '새 공급사')
        await user.selectOptions(dialog.getByLabelText('유형 *'), '발주처')
        await user.type(dialog.getByLabelText('담당자'), '이담당')
        await user.clear(dialog.getByLabelText('리드타임(일)'))
        await user.type(dialog.getByLabelText('리드타임(일)'), '10')
        await user.click(dialog.getByRole('button', { name: '등록' }))
        expect(await screen.findByText('거래처를 등록했습니다.')).toBeInTheDocument()
        expect(created).toMatchObject({ partnerNo: 'V-NEW', partnerType: '발주처', contactName: '이담당', paymentTerms: 30, leadTimeDays: 10 })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('edits without changing the partner code', async () => {
        const user = userEvent.setup()
        let patch: Record<string, unknown> | undefined
        renderPartners((_url, init) => {
            if (init?.method === 'PATCH') {
                patch = JSON.parse(String(init.body))
                return Response.json({ ...partner, ...patch })
            }
            return page()
        })
        await screen.findByText('C-LIVE')
        await user.click(screen.getByTitle('수정'))
        expect(screen.getByLabelText('거래처 코드 *')).toHaveAttribute('readonly')
        await user.clear(screen.getByLabelText('결제조건(일) *'))
        await user.type(screen.getByLabelText('결제조건(일) *'), '60')
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
        expect(await screen.findByText('거래처를 수정했습니다.')).toBeInTheDocument()
        expect(patch).toMatchObject({ paymentTerms: 60 })
        expect(patch).not.toHaveProperty('partnerNo')
    })

    it('keeps the form and trace ID visible on a duplicate error', async () => {
        const user = userEvent.setup()
        renderPartners((_url, init) => init?.method === 'PATCH'
            ? Response.json({ code: 'DUPLICATE', message: '동시 수정 충돌', traceId: 'partner-trace' }, { status: 409 }) : page())
        await screen.findByText('C-LIVE')
        await user.click(screen.getByTitle('수정'))
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
        expect(await screen.findByText('동시 수정 충돌')).toBeInTheDocument()
        expect(screen.getByText(/partner-trace/)).toBeInTheDocument()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('confirms deletion and retains the dialog when referenced', async () => {
        const user = userEvent.setup()
        renderPartners((_url, init) => init?.method === 'DELETE'
            ? Response.json({ code: 'PARTNER_IN_USE', message: '거래 이력이 있습니다.' }, { status: 409 }) : page())
        await screen.findByText('C-LIVE')
        await user.click(screen.getByTitle('삭제'))
        await user.click(screen.getByRole('button', { name: '삭제 확인' }))
        expect(await screen.findByText('거래 이력이 있습니다.')).toBeInTheDocument()
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it.each([['SALES', true], ['MATERIAL', false]])('enforces action visibility for %s', async (role, canEdit) => {
        renderPartners(() => page(), [role])
        await screen.findByText('C-LIVE')
        expect(Boolean(screen.queryByRole('button', { name: '거래처 등록' }))).toBe(canEdit)
        expect(Boolean(screen.queryByTitle('수정'))).toBe(canEdit)
        expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    })
})
