import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import SalesReceivables from './SalesReceivables'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['SALES'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const row = () => ({ id: 7, receivableNo: 'RV-LIVE', customerId: 9, customerName: '실제 고객', salesOrderId: 42 as number | null,
    salesOrderNo: 'SO-LIVE' as string | null, amount: 123400, collectedAmount: 100, openingCollectedAmount: 0, remainingAmount: 123300, dueDate: '2026-10-01', overdueDays: 3, status: '미수', overdue: true, referenceDate: '2026-10-04' })
const page = () => ({ content: [row()], number: 0, size: 10, totalElements: 1, totalPages: 1 })
function options(input: RequestInfo | URL) {
    return new URL(String(input)).pathname.endsWith('/partners') ? Response.json({ content: [{ id: 9, partnerNo: 'C-LIVE', name: '실제 고객', partnerType: '고객사', paymentTerms: 30, leadTimeDays: 0 }], number: 0, size: 100, totalElements: 1, totalPages: 1 }) : undefined
}
function respond(input: RequestInfo | URL) {
    return options(input) ?? Response.json(new URL(String(input)).pathname.endsWith('/summary')
        ? { openCount: 3, openAmount: 900000, overdueCount: 2, overdueAmount: 800000, openBalance: 899900, overdueBalance: 799900, referenceDate: '2026-10-04' } : page())
}
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SalesReceivables /></MemoryRouter></QueryClientProvider>) }
beforeEach(() => { state.roles = ['SALES']; state.fetch.mockReset(); state.fetch.mockImplementation(async input => respond(input)) })

it('renders actual document principal, global summary, linked order and date warning without write actions', async () => {
    const { container } = mount()
    await screen.findByText('RV-LIVE')
    expect(screen.getByRole('cell', { name: '123,400원' })).toBeInTheDocument()
    expect(await screen.findByText('900,000원')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SO-LIVE' })).toHaveAttribute('href', '/sales/orders?keyword=SO-LIVE')
    expect(screen.getByRole('cell', { name: '3일' })).toBeInTheDocument()
    expect(screen.getByText(/전체 미수 문서 원금/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '독촉 발송 검토' })).toBeEnabled()
    expect(screen.queryByText('AR-001')).not.toBeInTheDocument()
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})

it('filters by real customer, stored status, date-derived overdue and literal keyword; pages and sorts on server', async () => {
    state.fetch.mockImplementation(async input => {
        if (new URL(String(input)).pathname.endsWith('/receivables')) {
            const d = page(); d.totalElements = 11; d.totalPages = 2; d.number = Number(new URL(String(input)).searchParams.get('page')); return Response.json(d)
        }
        return respond(input)
    })
    mount(); const user = userEvent.setup(); await screen.findByText('RV-LIVE')
    await user.click(screen.getByRole('button', { name: '다음 페이지' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('page') === '1')).toBe(true))
    await waitFor(() => expect(screen.getByLabelText('미수 고객 필터')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('미수 고객 필터'), '9')
    await user.selectOptions(screen.getByLabelText('미수 상태 필터'), '미수')
    await user.selectOptions(screen.getByLabelText('날짜 연체 필터'), 'true')
    await user.type(screen.getByPlaceholderText('청구번호, 고객사, 수주번호 검색...'), '고객_100%')
    await user.click(screen.getByRole('button', { name: '문서 원금 정렬' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => {
        const q = new URL(String(input)).searchParams
        return q.get('customerId') === '9' && q.get('status') === '미수' && q.get('overdue') === 'true'
            && q.get('keyword') === '고객_100%' && q.get('page') === '0' && q.get('sort') === 'amount,asc'
    })).toBe(true))
    await user.selectOptions(screen.getByLabelText('페이지당 표시 건수'), '25')
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('size') === '25')).toBe(true))
})

it('shows traced errors, retry and empty results without fallback; refreshes global summary independently', async () => {
    state.fetch.mockImplementation(async input => options(input) ?? Response.json({ code: 'INTERNAL_ERROR', message: '미수 조회 실패' }, { status: 500, headers: { 'X-Trace-Id': 'trace-ar' } }))
    mount(); const user = userEvent.setup(); await screen.findAllByText('Trace ID: trace-ar')
    expect(screen.queryByText('RV-LIVE')).not.toBeInTheDocument()
    state.fetch.mockImplementation(async input => respond(input))
    for (const button of screen.getAllByRole('button', { name: '다시 시도' })) await user.click(button)
    await screen.findByText('RV-LIVE'); await screen.findByText('900,000원')
    state.fetch.mockImplementation(async input => options(input) ?? (new URL(String(input)).pathname.endsWith('/summary') ? respond(input) : Response.json({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 })))
    await user.click(screen.getByRole('button', { name: '미수 새로고침' }))
    await screen.findByText('조건에 맞는 미수 문서가 없습니다.')
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
})

it('keeps null order links unknown and makes no requests for unauthorized roles', async () => {
    state.roles = ['PRODUCTION']; const denied = mount()
    expect(screen.getByRole('alert')).toHaveTextContent('미수금 조회 권한이 없습니다.')
    expect(state.fetch).not.toHaveBeenCalled(); denied.unmount()
    state.roles = ['ACCOUNTING']
    state.fetch.mockImplementation(async input => {
        if (new URL(String(input)).pathname.endsWith('/receivables')) { const d = page(); d.content[0].salesOrderId = null; d.content[0].salesOrderNo = null; return Response.json(d) }
        return respond(input)
    })
    mount(); await screen.findByText('RV-LIVE')
    expect(screen.getByRole('cell', { name: '미연결' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'SO-LIVE' })).not.toBeInTheDocument()
})

it('keeps customer lookup failures visible and retries without hiding valid receivables', async () => {
    state.fetch.mockImplementation(async input => new URL(String(input)).pathname.endsWith('/partners')
        ? Response.json({ code: 'INTERNAL_ERROR', message: '고객 조회 실패' }, { status: 500, headers: { 'X-Trace-Id': 'trace-customer' } }) : respond(input))
    mount(); const user = userEvent.setup(); await screen.findByText('RV-LIVE')
    await screen.findByText('Trace ID: trace-customer')
    expect(screen.getByLabelText('미수 고객 필터')).toBeDisabled()
    state.fetch.mockImplementation(async input => respond(input))
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByLabelText('미수 고객 필터')).toBeEnabled())
})

it('shows pending reads and rejects malformed money instead of displaying fallback amounts', async () => {
    let resolve: (value: Response) => void = () => { throw new Error('request not started') }
    state.fetch.mockImplementation(input => new URL(String(input)).pathname.endsWith('/receivables')
        ? new Promise<Response>(done => { resolve = done }) : Promise.resolve(respond(input)))
    mount()
    await screen.findByRole('status')
    const d = page(); d.content[0].amount = Number.MAX_SAFE_INTEGER + 1
    resolve(Response.json(d, { headers: { 'X-Trace-Id': 'trace-unsafe' } }))
    await screen.findByText('Trace ID: trace-unsafe')
    expect(screen.queryByText('RV-LIVE')).not.toBeInTheDocument()
})

it('opens real collection history from the row and keeps SALES read-only', async () => {
    state.fetch.mockImplementation(async input => new URL(String(input)).pathname.endsWith('/receivables/7')
        ? Response.json({ receivable: row(), collections: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 } }) : respond(input))
    mount(); const user = userEvent.setup(); await screen.findByText('RV-LIVE')
    await user.click(screen.getByRole('button', { name: 'RV-LIVE 수납·이력' }))
    await screen.findByRole('dialog', { name: '미수금 수납·이력' })
    await screen.findByText('새 수납 이력이 없습니다.')
    expect(screen.queryByLabelText('수납 금액')).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('opens the real reminder target modal from the toolbar and cancels without writes', async () => {
    mount(); const user = userEvent.setup(); await screen.findByText('RV-LIVE')
    await user.click(screen.getByRole('button', { name: '독촉 발송 검토' }))
    await screen.findByRole('dialog', { name: '독촉 발송 검토' })
    await screen.findByRole('radio', { name: /RV-LIVE/ })
    expect(screen.getByRole('button', { name: '발송 (준비 중)' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '취소 / 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
