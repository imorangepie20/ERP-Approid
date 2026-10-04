import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { productionAnalysisFixture } from '../../test/productionAnalysisFixture'
import Analytics from './Analytics'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>() }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const item = { id: 7, itemNo: 'P-LIVE', name: '실제 생산 품목', itemType: '제품', unit: 'kg', price: 100, stock: 0, safetyStock: 5, leadTimeDays: 3 }
function items(input: RequestInfo | URL) {
    return new URL(String(input)).pathname.endsWith('/items') ? Response.json({ content: [item], number: 0, size: 100, totalElements: 1, totalPages: 1 }) : undefined
}
function mount(entry = '/analytics') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Analytics /></MemoryRouter>
    </QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset() })
it('initializes a valid dashboard item drill-down without inheriting a historical KPI period', async () => {
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(productionAnalysisFixture()))
    mount('/analytics?itemId=7')
    await screen.findByText('5 kg')
    expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('itemId') === '7')).toBe(true)
    expect(screen.getByLabelText('분석 품목')).toHaveValue('7')
})
it('shows actual quantities with units, rates, delay, source limits and a work-order drill-down', async () => {
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(productionAnalysisFixture()))
    const { container } = mount()
    const summary = await screen.findByRole('region', { name: '생산 분석 요약' })
    expect(within(summary).getByText('50%')).toBeInTheDocument()
    expect(within(summary).getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('5 kg')).toBeInTheDocument()
    expect(screen.getByText('현재 지연', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WO-LIVE' })).toHaveAttribute('href', '/production/orders?keyword=WO-LIVE')
    expect(screen.getByRole('button', { name: '완료예정 시작일 달력 열기' })).toBeEnabled()
    expect(screen.getByText(/설비 가동률·실제 공정시간/)).toBeInTheDocument()
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})
it('applies draft date/item/status/search only on submit and resets paging on sort/filter', async () => {
    const d = productionAnalysisFixture(); d.totalElements = 21; d.totalPages = 2
    Object.assign(d.summary, { totalOrders: 21, activeOrders: 21 })
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(d))
    mount(); const user = userEvent.setup()
    await screen.findByText('5 kg')
    await waitFor(() => expect(screen.getByLabelText('분석 품목')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('page') === '1')).toBe(true))
    fireEvent.change(screen.getByLabelText('완료예정 시작일'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('완료예정 종료일'), { target: { value: '2026-10-04' } })
    await user.selectOptions(screen.getByLabelText('분석 품목'), '7')
    await user.selectOptions(screen.getByLabelText('분석 상태'), 'all')
    await user.type(screen.getByLabelText('오더·품목·담당 검색'), '현장_100%')
    expect(state.fetch.mock.calls.filter(([u]) => String(u).includes('/analytics/production'))).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '분석 적용' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => {
        const q = new URL(String(u)).searchParams
        return q.get('itemId') === '7' && q.get('page') === '0' && q.get('keyword') === '현장_100%' && q.get('status') === 'all' && q.get('from') === '2026-10-01'
    })).toBe(true))
    await user.selectOptions(screen.getByLabelText('분석 정렬'), 'progressPercent,asc')
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('sort') === 'progressPercent,asc')).toBe(true))
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('shows loading and trace errors, retries without any sample fallback', async () => {
    let resolve: (r: Response) => void = () => {}
    state.fetch.mockImplementation(async input => items(input) ?? new Promise<Response>(r => { resolve = r }))
    mount(); expect(screen.getByText('생산 진척을 조회하는 중...')).toBeInTheDocument()
    expect(screen.queryByText('WO-LIVE')).not.toBeInTheDocument()
    resolve(Response.json({ code: 'INTERNAL_ERROR', message: '조회 실패' }, { status: 500, headers: { 'X-Trace-Id': 'production-error' } }))
    await screen.findByText('Trace ID: production-error')
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(productionAnalysisFixture()))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('5 kg')
})
it('keeps empty rates absent and disables paging instead of treating missing data as zero percent', async () => {
    const d = productionAnalysisFixture(); d.rows = []; d.totalElements = 0; d.totalPages = 0
    Object.assign(d.summary, { totalOrders: 0, activeOrders: 0, delayedOrders: 0, unassignedActiveOrders: 0,
        eligibleActiveOrders: 0, eligibleYieldOrders: 0, meanActiveProgressPercent: null, meanReportedYieldPercent: null })
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(d))
    mount(); await screen.findByText('조회 조건에 해당하는 작업오더가 없습니다.')
    expect(screen.getAllByText('해당 없음')).toHaveLength(2)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
})
it('displays legacy over-actual warning while preserving raw quantities and null ratios', async () => {
    const d = productionAnalysisFixture()
    Object.assign(d.summary, { overActualOrders: 1, eligibleActiveOrders: 0, eligibleYieldOrders: 0, meanActiveProgressPercent: null, meanReportedYieldPercent: null })
    Object.assign(d.rows[0], { goodQty: 11, remainingQty: 0, overActual: true, progressPercent: null, yieldPercent: null })
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(d))
    mount(); await screen.findByText('11 kg')
    expect(screen.getByRole('status')).toHaveTextContent('초과 실적 이력 1건')
    expect(screen.getByText('해당 없음 / 해당 없음')).toBeInTheDocument()
})
