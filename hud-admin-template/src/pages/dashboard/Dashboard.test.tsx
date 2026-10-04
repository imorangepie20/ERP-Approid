import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { dashboardFixture } from '../../test/dashboardFixture'
import { seoulToday } from '../../api/dashboard'
import Dashboard from './Dashboard'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['SALES'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const item = { id: 7, itemNo: 'P-LIVE', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100, stock: 0, safetyStock: 5, leadTimeDays: 3 }
function items(input: RequestInfo | URL) {
    return new URL(String(input)).pathname.endsWith('/items') ? Response.json({ content: [item], number: 0, size: 100, totalElements: 1, totalPages: 1 }) : undefined
}
function mount() {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>
    </QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['SALES'] })
it('renders real KPI values, calculation coverage, alert links and accessible date filters', async () => {
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(dashboardFixture()))
    const { container } = mount()
    const kpis = await screen.findByRole('region', { name: '운영 KPI' })
    expect(within(kpis).getByText('₩1,400')).toBeInTheDocument()
    expect(within(kpis).getByText('₩900')).toBeInTheDocument()
    expect(within(kpis).getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('계산 불가')).toBeInTheDocument()
    expect(screen.getByText(/이력 미확인: 출하 1건/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'P-LIVE 확인' })).toHaveAttribute('href', '/items?keyword=P-LIVE')
    expect(screen.getByRole('link', { name: '현재 생산 진척·지연 분석' })).toHaveAttribute('href', '/analytics')
    expect(screen.getByRole('link', { name: '실제 재고·Lot 근거 분석' })).toHaveAttribute('href', '/analytics/inventory')
    expect(screen.getByRole('link', { name: '실제 영업·미수 요약' })).toHaveAttribute('href', '/analytics/sales')
    expect(screen.getByRole('button', { name: '조회 시작일 달력 열기' })).toBeEnabled()
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})
it('applies dates and actual item IDs only on submit, refreshes and does not write', async () => {
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(dashboardFixture()))
    mount(); const user = userEvent.setup()
    await screen.findByText('계산 불가')
    await waitFor(() => expect(screen.getByLabelText('조회 품목')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('조회 종료일'), { target: { value: '2026-10-04' } })
    await user.selectOptions(screen.getByLabelText('조회 품목'), '7')
    expect(state.fetch.mock.calls.filter(([u]) => String(u).includes('/analytics/dashboard'))).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '조회 적용' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => String(u).includes('itemId=7'))).toBe(true))
    expect(screen.getByRole('link', { name: '현재 생산 진척·지연 분석' })).toHaveAttribute('href', '/analytics?itemId=7')
    expect(screen.getByRole('link', { name: '실제 재고·Lot 근거 분석' })).toHaveAttribute('href', '/analytics/inventory?itemId=7')
    expect(screen.getByRole('link', { name: '실제 영업·미수 요약' })).toHaveAttribute('href', '/analytics/sales?itemId=7')
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '새로고침' }))
    await waitFor(() => expect(state.fetch.mock.calls.filter(([u]) => String(u).includes('/analytics/dashboard'))).toHaveLength(3))
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('shows loading, server errors with trace and retry without sample KPI fallback', async () => {
    let resolve: (r: Response) => void = () => {}
    state.fetch.mockImplementation(async input => items(input) ?? new Promise<Response>(r => { resolve = r }))
    mount(); expect(screen.getByText('운영 지표를 불러오는 중...')).toBeInTheDocument()
    expect(screen.queryByText('₩1,400')).not.toBeInTheDocument()
    resolve(Response.json({ code: 'INTERNAL_ERROR', message: '집계 실패' }, { status: 500, headers: { 'X-Trace-Id': 'dashboard-error' } }))
    await screen.findByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    expect(screen.getByText('Trace ID: dashboard-error')).toBeInTheDocument()
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(dashboardFixture()))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('계산 불가')
})
it('shows empty confirmed history and no alerts without interpreting missing rates as zero', async () => {
    const d = dashboardFixture()
    Object.assign(d.kpis, { revenueKrw: 0, productionValueKrw: 0, backlogKrw: 0, backlogOrders: 0, completedWorkOrders: 0,
        onTimeOrders: 0, eligibleDeliveryOrders: 0, onTimeDeliveryPercent: null, meanOrderDefectPercent: null })
    d.trends = [{ month: '2026-10', revenueKrw: 0, productionValueKrw: 0 }]
    d.alerts = { lowStockItems: 0, overdueWorkOrders: 0, overdueSalesOrders: 0, total: 0, truncated: false, rows: [] }
    state.fetch.mockImplementation(async input => items(input) ?? Response.json(d))
    mount(); await screen.findByText('현재 위험 알림이 없습니다.')
    expect(screen.getByText('조회기간에 확인된 출하·생산완료 이력이 없습니다.')).toBeInTheDocument()
    expect(screen.getAllByText('해당 없음')).toHaveLength(2)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
})
it('uses Seoul date at UTC day and month boundaries', () => {
    expect(seoulToday(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10-01')
    expect(seoulToday(new Date('2026-09-30T14:59:59Z'))).toBe('2026-09-30')
})
