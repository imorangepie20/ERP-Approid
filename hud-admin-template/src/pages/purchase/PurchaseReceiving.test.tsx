import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import PurchaseReceiving from './PurchaseReceiving'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['MATERIAL'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const po = { id: 90, purchaseOrderNo: 'PO-LIVE', vendorId: 5, vendorName: '실제 공급사', itemId: 7, itemNo: 'M-LIVE', itemName: '실제 자재',
    qty: 100, receivedQty: 60, unitPrice: 100, amount: 10000, dueDate: '2026-12-31', status: '부분입고' }
const row = { id: 42, receivingNo: 'RC-LIVE', purchaseOrderId: 90, purchaseOrderNo: po.purchaseOrderNo,
    vendorId: 5, vendorName: po.vendorName, itemId: 7, itemNo: po.itemNo, itemName: po.itemName,
    orderQty: 100, receivedQty: 10, defectQty: 2, goodQty: 8, receivedDate: '2026-10-02', status: '부분합격',
    stockApplied: true, lotNo: 'LOT-LIVE', inventoryTxnNo: 'TX-LIVE', reversalTxnNo: null as string | null, cancelledDate: null as string | null }
const page = (content: unknown[], total = content.length, number = 0) => ({ content, number, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PurchaseReceiving /></QueryClientProvider>) }
function options(url: URL) { if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([po, { ...po, id: 91, purchaseOrderNo: 'PO-CLOSED', status: '입고완료' }, { ...po, id: 92, purchaseOrderNo: 'PO-CANCEL', status: '취소' }])) }
async function ready() { await waitFor(() => expect(screen.getByRole('button', { name: '입고 등록' })).toBeEnabled(), { timeout: 5000 }) }
beforeEach(() => { state.fetch.mockReset(); state.roles = ['MATERIAL'] })

it('creates receipts with real purchase IDs, remaining quantities and calendar input then refreshes related data', async () => {
    let rows: typeof row[] = [], ordered = po
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([ordered, { ...po, id: 91, purchaseOrderNo: 'PO-CLOSED', status: '입고완료' }]))
        if (init?.method === 'POST') { rows = [row]; ordered = { ...po, receivedQty: 70 }; return Response.json({ receiving: row, lotNo: row.lotNo, inventoryTxnNo: row.inventoryTxnNo }, { status: 201 }) }
        return Response.json(page(rows))
    })
    mount(); const user = userEvent.setup(); await ready(); await user.click(screen.getByRole('button', { name: '입고 등록' }))
    expect(within(screen.getByLabelText('발주번호 *')).queryByRole('option', { name: /PO-CLOSED/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('발주번호 *'), '90')
    expect(screen.getByText('발주 100 · 누적입고 60 · 잔량 40 · 부분입고')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '입고일 달력 열기' })).toBeEnabled()
    await user.clear(screen.getByLabelText('총 입고수량 *')); await user.type(screen.getByLabelText('총 입고수량 *'), '10')
    await user.clear(screen.getByLabelText('불량수량 *')); await user.type(screen.getByLabelText('불량수량 *'), '2')
    fireEvent.change(screen.getByLabelText('입고일 *'), { target: { value: '2026-10-02' } })
    await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByText('입고를 등록했습니다. Lot LOT-LIVE · 입고 TX-LIVE'); await screen.findByText('RC-LIVE')
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body)))
        .toEqual({ purchaseOrderId: 90, receivedQty: 10, defectQty: 2, receivedDate: '2026-10-02' })
    expect(state.fetch.mock.calls.filter(([url]) => String(url).includes('/purchase-orders?')).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument(); expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
}, 15000)

it('cancels via compensation and preserves the original and reversal numbers in server detail', async () => {
    let current = row
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const lookup = options(url); if (lookup) return lookup
        if (init?.method === 'POST') { current = { ...row, status: '취소', reversalTxnNo: 'TX-REVERSE', cancelledDate: '2026-10-02' }; return Response.json({ receiving: current, lotNo: row.lotNo, inventoryTxnNo: 'TX-REVERSE' }) }
        return Response.json(url.pathname.endsWith('/42') ? current : page([current]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('RC-LIVE')
    await user.click(screen.getByRole('button', { name: '입고 취소' })); await user.click(screen.getByRole('button', { name: '입고 취소 확인' }))
    await screen.findByText('입고를 취소했습니다. 역출고 TX-REVERSE')
    expect(screen.queryByRole('button', { name: '입고 취소' })).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([url, init]) => String(url).endsWith('/receivings/42/cancel') && init?.method === 'POST')).toBe(true)
    expect(state.fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText('Lot: LOT-LIVE · 원 입고: TX-LIVE')
    expect(screen.getByText('역출고: TX-REVERSE · 취소일: 2026-10-02')).toBeInTheDocument()
    await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('keeps historical receipts read-only and explains missing inventory links', async () => {
    const historical = { ...row, stockApplied: false, lotNo: null, inventoryTxnNo: null }
    state.fetch.mockImplementation(async input => { const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? historical : page([historical])) })
    mount(); const user = userEvent.setup(); await screen.findByText('RC-LIVE')
    expect(screen.queryByRole('button', { name: '입고 취소' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '상세' })); expect(await screen.findByText('과거 입고: 재고 반영/연결 정보 확인 전 자동 취소 불가')).toBeInTheDocument()
})

it('retains server conflicts and trace IDs and blocks repeated cancel submissions', async () => {
    let reply: ((r: Response) => void) | undefined
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') return new Promise<Response>(resolve => { reply = resolve })
        return Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('RC-LIVE')
    await user.click(screen.getByRole('button', { name: '입고 취소' })); await user.click(screen.getByRole('button', { name: '입고 취소 확인' }))
    expect(screen.getByRole('button', { name: /처리 중/ })).toBeDisabled()
    expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    reply?.(Response.json({ code: 'IN_USE', message: '이미 사용된 Lot입니다.', traceId: 'rc-conflict' }, { status: 409 }))
    await screen.findByText('이미 사용된 Lot입니다.'); expect(screen.getByText('Trace ID: rc-conflict')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('shows form field errors without losing input or falling back to memory', async () => {
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') return Response.json({ code: 'INVALID_INPUT', message: '입고수량 정밀도를 확인하세요.', traceId: 'rc-form', errors: [{ field: 'receivedQty', reason: '소수 4자리까지 허용합니다.' }] }, { status: 400 })
        return Response.json(page([]))
    })
    mount(); const user = userEvent.setup(); await ready(); await user.click(screen.getByRole('button', { name: '입고 등록' }))
    await user.selectOptions(screen.getByLabelText('발주번호 *'), '90'); await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByText('입고수량 정밀도를 확인하세요.')
    expect(screen.getByText('receivedQty: 소수 4자리까지 허용합니다.')).toBeInTheDocument(); expect(screen.getByText('Trace ID: rc-form')).toBeInTheDocument()
    expect(screen.getByLabelText('발주번호 *')).toHaveValue('90'); expect(screen.getByLabelText('총 입고수량 *')).toHaveValue(1)
})

it('retries failed real purchase options and list reads and keeps creation disabled until options are available', async () => {
    let fail = true
    state.fetch.mockImplementation(async input => {
        if (fail) return Response.json({ code: 'ERROR', message: 'error', traceId: 'rc-read' }, { status: 503 })
        return options(new URL(String(input))) ?? Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findAllByText(/서버 오류가 발생했습니다/)
    expect(screen.getByRole('button', { name: '입고 등록' })).toBeDisabled(); expect(screen.queryByText('RC-2610-001')).not.toBeInTheDocument()
    fail = false; for (const retry of screen.getAllByRole('button', { name: '다시 시도' })) await user.click(retry)
    await ready(); await screen.findByText('RC-LIVE')
})

it.each(['SALES', 'PRODUCTION'])('keeps %s read-only', async role => {
    state.roles = [role]; state.fetch.mockImplementation(async input => options(new URL(String(input))) ?? Response.json(page([row])))
    mount(); await screen.findByText('RC-LIVE')
    expect(screen.queryByRole('button', { name: '입고 등록' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '입고 취소' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '상세' })).toBeEnabled()
})

it('sends server filters, search, sorting and pages', async () => {
    state.fetch.mockImplementation(async input => { const url = new URL(String(input)); return options(url) ?? Response.json(page([row], 21, Number(url.searchParams.get('page')))) })
    mount(); const user = userEvent.setup(); await screen.findByText('RC-LIVE')
    await user.selectOptions(screen.getByLabelText('입고 상태 필터'), '부분합격'); await user.selectOptions(screen.getByLabelText('발주 필터'), '90')
    fireEvent.change(screen.getByPlaceholderText('입고번호, 발주번호, 발주처, 품번 검색...'), { target: { value: 'LIVE' } })
    await user.click(within(screen.getByRole('columnheader', { name: '총 입고' })).getByRole('button')); await user.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => { const p = new URL(String(input)).searchParams;
        return p.get('keyword') === 'LIVE' && p.get('status') === '부분합격' && p.get('purchaseOrderId') === '90' && p.get('sort') === 'receivedQty,asc' && p.get('page') === '1'
    })).toBe(true))
})

it('has no axe violations in list, create, cancel and detail dialogs', async () => {
    state.fetch.mockImplementation(async input => { const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? row : page([row])) })
    const { container } = mount(); const user = userEvent.setup(); await ready(); await screen.findByText('RC-LIVE')
    const check = async (element: HTMLElement) => { const result = await axe.run(element, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } }); expect(result.violations.map(v => v.id)).toEqual([]) }
    await check(container); await user.click(screen.getByRole('button', { name: '입고 등록' })); await check(screen.getByRole('dialog'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '입고 취소' })); await check(screen.getByRole('dialog')); await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText('Lot: LOT-LIVE · 원 입고: TX-LIVE'); await check(screen.getByRole('dialog'))
}, 15000)
