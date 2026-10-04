import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { salesAnalysisFixture } from '../../test/salesAnalysisFixture'
import SalesAnalysis from './SalesAnalysis'
const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['SALES'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const item = { id: 7, itemNo: 'P-LIVE', name: '실제 제품', itemType: '제품', unit: 'kg', price: 100, stock: 0, safetyStock: 0, leadTimeDays: 3 }
const customer = { id: 90, partnerNo: 'C-LIVE', name: '실제 고객', partnerType: '고객사', contact: '', contactName: '', paymentTerms: 60, leadTimeDays: 9 }
function options(input: RequestInfo | URL) {
    const url = new URL(String(input)); const rows = url.pathname.endsWith('/items') ? [item] : url.pathname.endsWith('/partners') ? [customer] : undefined
    return rows ? Response.json({ content: rows, number: 0, size: 100, totalElements: 1, totalPages: 1 }) : undefined
}
function mount(entry = '/analytics/sales') { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SalesAnalysis /></MemoryRouter></QueryClientProvider>) }
beforeEach(() => { state.roles = ['SALES']; state.fetch.mockReset(); state.fetch.mockImplementation(async input => options(input) ?? Response.json(salesAnalysisFixture())) })
it('shows separate period/current money, units, provenance, actual drill-down and accessible controls', async () => {
    const { container } = mount('/analytics/sales?itemId=7')
    const summary = await screen.findByRole('region', { name: '영업 분석 요약' })
    expect(within(summary).getByText('₩1,000')).toBeInTheDocument(); expect(within(summary).getByText('₩600')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /10 kg.*4 kg/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SO-LIVE' })).toHaveAttribute('href', '/sales/orders?keyword=SO-LIVE')
    expect(screen.getByRole('link', { name: '연결 출하 보기' })).toHaveAttribute('href', '/sales/shipments?salesOrderId=42')
    expect(screen.queryByRole('link', { name: /미수/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '실적 시작일 달력 열기' })).toBeEnabled()
    expect(screen.getByText(/부분수납 이력이 없어/)).toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('itemId') === '7')).toBe(true)
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})
it('applies date/customer/item/literal filters only on submit, switches current scope and sorting, refreshes read-only', async () => {
    mount(); const user = userEvent.setup(); await screen.findByRole('cell', { name: /10 kg.*4 kg/ })
    await waitFor(() => expect(screen.getByLabelText('영업 고객')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('실적 시작일'), { target: { value: '2026-10-01' } })
    await user.selectOptions(screen.getByLabelText('영업 고객'), '90'); await user.selectOptions(screen.getByLabelText('영업 품목'), '7')
    await user.type(screen.getByLabelText('수주·고객·품목 검색'), '고객_100%')
    expect(state.fetch.mock.calls.filter(([u]) => String(u).includes('/analytics/sales'))).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '영업 분석 적용' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => {
        const q = new URL(String(u)).searchParams; return q.get('customerId') === '90' && q.get('itemId') === '7' && q.get('keyword') === '고객_100%'
    })).toBe(true))
    await user.selectOptions(screen.getByLabelText('영업 목록 범위'), 'receivables')
    await user.selectOptions(screen.getByLabelText('영업 정렬'), 'openReceivableKrw,desc')
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('sort') === 'openReceivableKrw,desc')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: '영업 현재값 새로고침' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '영업 현재값 새로고침' }))
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('renders loading/trace/error/retry without any demo summary fallback', async () => {
    let resolve: (r: Response) => void = () => {}
    state.fetch.mockImplementation(async input => options(input) ?? new Promise<Response>(r => { resolve = r }))
    mount(); expect(screen.getByText('영업 요약을 조회하는 중...')).toBeInTheDocument(); expect(screen.queryByText('SO-LIVE')).not.toBeInTheDocument()
    resolve(Response.json({ code: 'INTERNAL_ERROR', message: '집계 실패' }, { status: 500, headers: { 'X-Trace-Id': 'sales-error' } }))
    await screen.findByText('Trace ID: sales-error')
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(salesAnalysisFixture()))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('SO-LIVE')
})
it('renders empty current records with bounded paging', async () => {
    const d = salesAnalysisFixture(); d.rows = []; d.totalElements = 0; d.totalPages = 0
    for (const key of Object.keys(d.summary)) Object.assign(d.summary, { [key]: 0 })
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(d))
    mount(); await screen.findByText('조회 범위에 해당하는 수주가 없습니다.')
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
})
it('displays unknown historical backlog explicitly while preserving known source amounts', async () => {
    const d = salesAnalysisFixture(); d.rows[0].historyUnknown = true; d.rows[0].currentBacklogKrw = null
    d.summary.unknownBacklogOrders = 1; d.summary.knownCurrentBacklogKrw = 0; d.summary.excludedHistoricalShipments = 1
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(d))
    mount(); await screen.findByText('이력 미확인'); expect(screen.getByText('이력 확인 필요')).toBeInTheDocument()
    expect(screen.getByText(/잔고 미확인 1건/)).toBeInTheDocument()
})
it.each(['MATERIAL', 'PRODUCTION', 'QUALITY'])('prevents %s from fetching or displaying receivable analytics', role => {
    state.roles = [role]; mount()
    expect(screen.getByRole('alert')).toHaveTextContent('ADMIN·SALES·ACCOUNTING만 조회')
    expect(state.fetch).not.toHaveBeenCalled()
})
