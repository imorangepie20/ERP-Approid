import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { inventoryAnalysisFixture } from '../../test/inventoryAnalysisFixture'
import InventoryAnalysis from './InventoryAnalysis'
import InventoryStock from '../inventory/InventoryStock'
const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>() }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: ['MATERIAL'] }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
function options(input: RequestInfo | URL) {
    if (!new URL(String(input)).pathname.endsWith('/items')) return undefined
    return Response.json({ content: [{ id: 7, itemNo: 'M-LIVE', name: '실제 자재', itemType: '자재', unit: 'kg', price: 100, stock: 30, safetyStock: 40, leadTimeDays: 3 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
}
function mount(entry = '/analytics/inventory') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{entry.startsWith('/inventory/stock') ? <InventoryStock /> : <InventoryAnalysis />}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset(); state.fetch.mockImplementation(async input => options(input) ?? Response.json(inventoryAnalysisFixture())) })
it('replaces the stock prototype with real source units, risks, unavailable turnover and actual links', async () => {
    const { container } = mount('/inventory/stock?itemId=7')
    const summary = await screen.findByRole('region', { name: '재고 분석 요약' })
    expect(within(summary).getByText('계산 불가')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /30 kg.*40 kg.*현재고 미달/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /28 kg.*2 kg.*수불 차이 확인/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'M-LIVE' })).toHaveAttribute('href', '/items?keyword=M-LIVE')
    expect(screen.getByRole('link', { name: '실제 발주제안 보기' })).toHaveAttribute('href', '/purchase/mrp?itemId=7')
    expect(screen.getByRole('link', { name: '실제 Lot 원천 보기' })).toHaveAttribute('href', '/inventory/lots?itemId=7')
    expect(screen.getByRole('button', { name: '수불 시작일 달력 열기' })).toBeEnabled()
    expect(screen.getByText(/무출고 기간을 추정하지/)).toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('itemId') === '7')).toBe(true)
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})
it('applies draft dates, age, literal search and item only on submit then filters risks/sorts and refreshes GET', async () => {
    mount(); const user = userEvent.setup(); await screen.findByText('M-LIVE')
    await waitFor(() => expect(screen.getByLabelText('재고 품목')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('수불 시작일'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Lot 경과 기준일수'), { target: { value: '91' } })
    await user.selectOptions(screen.getByLabelText('재고 품목'), '7')
    await user.type(screen.getByLabelText('재고 품번·품명 검색'), '재고_100%')
    expect(state.fetch.mock.calls.filter(([u]) => String(u).includes('/analytics/inventory'))).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '재고 분석 적용' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => { const q = new URL(String(u)).searchParams; return q.get('ageDays') === '91' && q.get('itemId') === '7' && q.get('keyword') === '재고_100%' })).toBe(true))
    await user.selectOptions(screen.getByLabelText('재고 품목 유형'), '자재')
    await user.selectOptions(screen.getByLabelText('재고 위험 범위'), 'ledger')
    await user.selectOptions(screen.getByLabelText('재고 정렬'), 'stockLedgerDelta,asc')
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('sort') === 'stockLedgerDelta,asc')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: '재고 현재값 새로고침' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '재고 현재값 새로고침' }))
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    fireEvent.change(screen.getByLabelText('Lot 경과 기준일수'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: '재고 분석 적용' })).toBeDisabled()
})
it('shows loading and trace failure then retries without fallback stock', async () => {
    let resolve: (r: Response) => void = () => {}
    state.fetch.mockImplementation(async input => options(input) ?? new Promise<Response>(r => { resolve = r }))
    mount(); expect(screen.getByText('실제 재고를 조회하는 중...')).toBeInTheDocument()
    resolve(Response.json({ code: 'INTERNAL_ERROR', message: '재고 실패' }, { status: 500, headers: { 'X-Trace-Id': 'inventory-error' } }))
    await screen.findByText('Trace ID: inventory-error'); expect(screen.queryByRole('region', { name: '재고 분석 요약' })).not.toBeInTheDocument()
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(inventoryAnalysisFixture()))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('M-LIVE')
})
it('shows empty filtered sources with bounded paging', async () => {
    const d = inventoryAnalysisFixture(); d.rows = []; d.totalElements = 0; d.totalPages = 0
    for (const key of Object.keys(d.summary)) if (key !== 'inventoryTurnover') Object.assign(d.summary, { [key]: 0 })
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(d))
    mount(); await screen.findByText('조회 범위에 해당하는 품목이 없습니다.')
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled(); expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
})
it('requests the next real page then disables the last page without changing summary totals', async () => {
    state.fetch.mockImplementation(async input => {
        const selected = options(input); if (selected) return selected
        const d = inventoryAnalysisFixture(); d.totalElements = 21; d.totalPages = 2; d.summary.totalItems = 21
        d.page = Number(new URL(String(input)).searchParams.get('page')); return Response.json(d)
    })
    mount(); await screen.findByText('M-LIVE'); await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByText('2 / 2 페이지 · 21종')
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled(); expect(screen.getByRole('button', { name: '이전' })).toBeEnabled()
    expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).searchParams.get('page') === '1')).toBe(true)
})
