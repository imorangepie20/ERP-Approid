import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { lotTraceDetail, lotTracePage } from '../../test/lotTraceFixture'
import InventoryLots from './InventoryLots'
const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>() }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: ['MATERIAL'] }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
function options(input: RequestInfo | URL) {
    if (!new URL(String(input)).pathname.endsWith('/items')) return undefined
    return Response.json({ content: [{ id: 9, itemNo: 'M-LIVE', name: '실제 자재', itemType: '자재', unit: 'kg', price: 100, stock: 5, safetyStock: 0, leadTimeDays: 0 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
}
function mount(entry = '/inventory/lots?itemId=9') { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><InventoryLots /></MemoryRouter></QueryClientProvider>) }
beforeEach(() => { state.fetch.mockReset(); state.fetch.mockImplementation(async input => options(input) ?? Response.json(new URL(String(input)).pathname.endsWith('/7') ? lotTraceDetail() : lotTracePage())) })
it('replaces the prototype with units and opens accessible real linked detail without write actions', async () => {
    mount(); const user = userEvent.setup(); await screen.findByRole('button', { name: 'LOT-LIVE' })
    expect(screen.getByRole('cell', { name: '5 kg' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Lot 등록' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'LOT-LIVE' })); const dialog = await screen.findByRole('dialog')
    const link = await within(dialog).findByRole('link', { name: 'RECEIVING · RC-LIVE' })
    expect(link).toHaveAttribute('href', '/purchase/receiving?keyword=RC-LIVE')
    expect(within(dialog).getByRole('link', { name: '실제 품목 재고 비교' })).toHaveAttribute('href', '/analytics/inventory?itemId=9')
    expect(within(dialog).getByText(/입고 · 5 kg/)).toBeInTheDocument()
    expect((await axe.run(dialog, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
it('passes URL item, literal search, status, warehouse and sorting to the server and refreshes reads', async () => {
    mount(); const user = userEvent.setup(); await screen.findByText('LOT-LIVE'); await waitFor(() => expect(screen.getByLabelText('Lot 품목 필터')).toBeEnabled())
    expect(screen.getByLabelText('Lot 품목 필터')).toHaveValue('9')
    fireEvent.change(screen.getByPlaceholderText('Lot 번호, 품번, 품명 검색...'), { target: { value: 'Lot_100%' } })
    await user.selectOptions(screen.getByLabelText('Lot 상태 필터'), '보류')
    fireEvent.change(screen.getByLabelText('Lot 기록 창고 필터'), { target: { value: '기록창고' } })
    await user.click(screen.getByText('기록 잔량'))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => { const q = new URL(String(input)).searchParams; return q.get('itemId') === '9' && q.get('keyword') === 'Lot_100%' && q.get('status') === '보류' && q.get('warehouse') === '기록창고' && q.get('sort') === 'qty,asc' })).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lot 새로고침' })).toBeEnabled()); await user.click(screen.getByRole('button', { name: 'Lot 새로고침' }))
})
it('shows traced errors and retry without fabricated data then handles empty sources', async () => {
    state.fetch.mockImplementation(async input => options(input) ?? Response.json({ code: 'INTERNAL_ERROR', message: '추적 실패' }, { status: 500, headers: { 'X-Trace-Id': 'trace-failed' } }))
    mount(); await screen.findByText('Trace ID: trace-failed'); expect(screen.queryByText('LOT-LIVE')).not.toBeInTheDocument()
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(lotTracePage()))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('LOT-LIVE')
    const d = lotTraceDetail(); d.movements = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 }
    state.fetch.mockImplementation(async input => options(input) ?? Response.json(new URL(String(input)).pathname.endsWith('/7') ? d : lotTracePage()))
    await userEvent.click(screen.getByRole('button', { name: 'LOT-LIVE' })); await screen.findByText(/명시적으로 연결된 수불이 없습니다/)
    expect(screen.getByRole('button', { name: '다음 수불' })).toBeDisabled()
})
it('pages movements and shows unknown sources rather than guessing document links', async () => {
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); const d = lotTraceDetail()
        if (url.pathname.endsWith('/7')) { d.movements.totalElements = 21; d.movements.totalPages = 2; d.movements.number = Number(url.searchParams.get('page'))
            if (d.movements.number === 1) Object.assign(d.movements.content[0], { sourceType: 'UNLINKED', sourceId: null, sourceNo: null, qty: -5 }); return Response.json(d) }
        return options(input) ?? Response.json(lotTracePage())
    })
    mount(); await userEvent.click(await screen.findByRole('button', { name: 'LOT-LIVE' })); await screen.findByRole('link', { name: 'RECEIVING · RC-LIVE' })
    await userEvent.click(screen.getByRole('button', { name: '다음 수불' })); await screen.findByText('원천 연결 미확인')
    expect(screen.queryByRole('link', { name: 'RECEIVING · RC-LIVE' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: '다음 수불' })).toBeDisabled()
    expect(state.fetch.mock.calls.some(([input]) => String(input).includes('/lot-traces/7?page=1'))).toBe(true)
})
