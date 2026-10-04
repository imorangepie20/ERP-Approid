import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import SalesShipments from './SalesShipments'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['SALES'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const order = { id: 90, salesOrderNo: 'SO-LIVE', customerId: 1, customerName: '실제 고객', itemId: 2, itemNo: 'P-LIVE', itemName: '실제 제품',
    qty: 10, unitPrice: 100, amount: 1000, paymentTerms: 7, leadTimeDays: 0, dueDate: '2026-12-31', orderedAt: '2026-10-02', status: '확정', workOrderNos: [] }
const row = { id: 42, shipmentNo: 'SH-LIVE', salesOrderId: 90, salesOrderNo: 'SO-LIVE', customerId: 1, customerName: '실제 고객', itemId: 2, itemNo: 'P-LIVE', itemName: '실제 제품',
    qty: 4, amount: 400, deliveryDate: '2026-12-31', vehicle: '차량', trackingNo: '송장', status: '배차', lotId: 7, lotNo: 'LOT-LIVE' }
const page = (content: unknown[], total = content.length) => ({ content, number: 0, size: 100, totalElements: total, totalPages: Math.ceil(total / 100) })
const lots = [{ id: 7, lotNo: 'LOT-LIVE', itemId: 2, qty: 10, warehouse: '완제품창고', status: '정상' }, { id: 8, lotNo: 'LOT-HOLD', itemId: 2, qty: 10, warehouse: '완제품창고', status: '보류' }]
function options(url: URL) {
    if (url.pathname.endsWith('/sales-orders')) return Response.json(page([order, { ...order, id: 91, salesOrderNo: 'SO-CANCEL', status: '취소' }]))
    if (url.pathname.endsWith('/lots')) return Response.json(lots)
}
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SalesShipments /></QueryClientProvider>) }
beforeEach(() => { state.fetch.mockReset(); state.roles = ['SALES']; state.fetch.mockImplementation(async input => options(new URL(String(input))) ?? Response.json(page([row]))) })

it('creates with real order/Lot IDs, shows allocated balance, calendar and refreshes caches', async () => {
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const option = options(url); if (option) return option
        if (init?.method === 'POST') return Response.json({ ...row, status: '지시' }, { status: 201 })
        return Response.json(page(url.searchParams.has('salesOrderId') ? [{ ...row, qty: 3 }] : []))
    })
    mount(); const user = userEvent.setup(); await waitFor(() => expect(screen.getByRole('button', { name: '출하 지시' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '출하 지시' }))
    expect(within(screen.getByLabelText('수주번호 *')).queryByRole('option', { name: /SO-CANCEL/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('수주번호 *'), '90'); await screen.findByText('수주 10 · 다른 출하 지시 3 · 지시 가능 잔량 7')
    expect(within(screen.getByLabelText('출하 Lot *')).queryByRole('option', { name: /LOT-HOLD/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('출하 Lot *'), '7')
    expect(screen.getByRole('button', { name: '배송 예정일 달력 열기' })).toBeEnabled()
    await user.clear(screen.getByLabelText('출하 수량 *')); await user.type(screen.getByLabelText('출하 수량 *'), '2.5')
    fireEvent.change(screen.getByLabelText('배송 예정일 *'), { target: { value: '2026-12-31' } })
    await user.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('SH-LIVE 저장했습니다.')
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))).toMatchObject({ salesOrderId: 90, lotId: 7, qty: 2.5, deliveryDate: '2026-12-31' })
    expect(state.fetch.mock.calls.filter(([url]) => String(url).includes('/sales-orders?')).length).toBeGreaterThan(1)
}, 15000)

it('edits immutable order instructions and preserves entered data on server field errors', async () => {
    state.fetch.mockImplementation(async (input, init) => options(new URL(String(input))) ?? (init?.method === 'PATCH'
        ? Response.json({ code: 'INVALID_INPUT', message: '정밀도 오류', traceId: 'sh-form', errors: [{ field: 'qty', reason: '소수 4자리' }] }, { status: 400 }) : Response.json(page([row]))))
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE'); await user.click(screen.getByRole('button', { name: '수정' }))
    expect(screen.getByLabelText('수주번호 *')).toBeDisabled(); await screen.findByText(/지시 가능 잔량/)
    await user.clear(screen.getByLabelText('출하 수량 *')); await user.type(screen.getByLabelText('출하 수량 *'), '2')
    await user.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('Trace ID: sh-form')
    expect(screen.getByLabelText('출하 수량 *')).toHaveValue(2); expect(screen.getByText('qty: 소수 4자리')).toBeInTheDocument()
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body))).not.toHaveProperty('salesOrderId')
}, 15000)

it('confirms atomically and displays actual inventory and receivable numbers in detail', async () => {
    let current: object = row
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const option = options(url); if (option) return option
        if (init?.method === 'POST') { current = { ...row, status: '출하완료', inventoryTxnNo: 'IVT-LIVE', receivableNo: 'RV-LIVE', confirmedDate: '2026-10-02' }; return Response.json({ shipment: current, inventoryTxnNo: 'IVT-LIVE', receivableNo: 'RV-LIVE' }) }
        return Response.json(url.pathname.endsWith('/42') ? current : page([current]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE')
    await user.click(screen.getByRole('button', { name: '출하 확정' })); await user.click(screen.getByRole('button', { name: '출하 확정 확인' }))
    await screen.findByText('출하 확정: SH-LIVE · 출고 IVT-LIVE · 미수 RV-LIVE')
    expect(screen.queryByRole('button', { name: '출하 취소' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText('Lot: LOT-LIVE · 출고: IVT-LIVE · 미수: RV-LIVE')
    await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it.each([['지시', '배차', 'dispatch'], ['배차', '출발', 'depart'], ['배차', '출하 취소', 'cancel']])('calls %s action %s on the server', async (status, label, action) => {
    state.fetch.mockImplementation(async (input, init) => options(new URL(String(input))) ?? Response.json(init?.method === 'POST' ? { ...row, status: action === 'cancel' ? '취소' : label } : page([{ ...row, status }])))
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE'); await user.click(screen.getByRole('button', { name: label })); await user.click(screen.getByRole('button', { name: `${label} 확인` }))
    await screen.findByText(`SH-LIVE ${action === 'cancel' ? '취소' : label} 처리했습니다.`)
    expect(state.fetch.mock.calls.some(([url, init]) => String(url).endsWith(`/shipments/42/${action}`) && init?.method === 'POST')).toBe(true)
})

it('retains conflicts/trace and blocks duplicate confirmation submissions', async () => {
    let reply: ((r: Response) => void) | undefined
    state.fetch.mockImplementation(async (input, init) => options(new URL(String(input))) ?? (init?.method === 'POST' ? new Promise<Response>(resolve => { reply = resolve }) : Response.json(page([row]))))
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE'); await user.click(screen.getByRole('button', { name: '출하 확정' })); await user.click(screen.getByRole('button', { name: '출하 확정 확인' }))
    expect(screen.getByRole('button', { name: '처리 중...' })).toBeDisabled(); expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    reply?.(Response.json({ code: 'INSUFFICIENT_STOCK', message: '재고 부족', traceId: 'sh-conflict' }, { status: 422 }))
    await screen.findByText('Trace ID: sh-conflict'); expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('shows historical unlinked shipments without confirm actions or invented revenue links', async () => {
    const historical = { ...row, lotId: undefined, lotNo: undefined }
    state.fetch.mockImplementation(async input => { const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? historical : page([historical])) })
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE'); expect(screen.queryByRole('button', { name: '출하 확정' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText(/과거 출하: Lot·출고·미수 연결은 추정하지 않습니다/)
})

it.each(['MATERIAL', 'PRODUCTION'])('limits %s to read-only', async role => {
    state.roles = [role]; mount(); await screen.findByText('SH-LIVE')
    for (const name of ['출하 지시', '수정', '배차', '출발', '출하 확정', '출하 취소']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '상세' })).toBeEnabled()
})

it('handles option errors/retry and server status/order filters and sorting', async () => {
    let fail = true
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); if (url.pathname.endsWith('/sales-orders') && fail) return Response.json({ code: 'INTERNAL_ERROR', message: '수주 조회 실패', traceId: 'sh-options' }, { status: 500 })
        return options(url) ?? Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('Trace ID: sh-options'); expect(screen.getByRole('button', { name: '출하 지시' })).toBeDisabled()
    fail = false; await user.click(screen.getByRole('button', { name: '다시 시도' })); await waitFor(() => expect(screen.getByRole('button', { name: '출하 지시' })).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('출하 상태 필터'), '배차'); await user.selectOptions(screen.getByLabelText('수주 필터'), '90')
    await user.click(screen.getByRole('button', { name: /^수량/ }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([url]) => { const q = new URL(String(url)).searchParams; return q.get('salesOrderId') === '90' && q.get('status') === '배차' && q.get('sort') === 'qty,asc' })).toBe(true))
})

it('has no axe violations in list/create/action/detail surfaces', async () => {
    state.fetch.mockImplementation(async input => { const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? row : page([row])) })
    mount(); const user = userEvent.setup(); await screen.findByText('SH-LIVE')
    const check = async () => expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
    await check(); await user.click(screen.getByRole('button', { name: '출하 지시' })); await check(); await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '출하 확정' })); await check(); await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText('차량: 차량 · 송장: 송장'); await check()
}, 15000)
