import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import SalesQuotations from './SalesQuotations'
import SalesOrders from './SalesOrders'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['SALES'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const partner = { id: 90, partnerNo: 'C-LIVE', name: '실제 고객', partnerType: '고객사', contact: '', contactName: '', paymentTerms: 60, leadTimeDays: 9 }
const item = { id: 7, itemNo: 'P-LIVE', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100, stock: 0, safetyStock: 0, leadTimeDays: 3 }
const common = { id: 42, customerId: 90, customerName: partner.name, itemId: 7, itemNo: item.itemNo, itemName: item.name,
    qty: 2, unitPrice: 100, amount: 200, dueDate: '2026-12-31', paymentTerms: 60, leadTimeDays: 9 }
const quote = { ...common, quotationNo: 'QT-LIVE', validUntil: '2026-12-20', status: '작성중' }
const order = { ...common, salesOrderNo: 'SO-LIVE', quotationId: null, quotationNo: null, workOrderNos: [] as string[], orderedAt: '2026-10-02', status: '대기' }
const page = (content: unknown[], total = content.length, number = 0) => ({ content, number, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) })
function mount(orders = false) {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{orders ? <SalesOrders /> : <SalesQuotations />}</MemoryRouter>
    </QueryClientProvider>)
}
function options(url: URL): Response | undefined {
    if (url.pathname.endsWith('/partners')) return Response.json(page([partner]))
    if (url.pathname.endsWith('/items')) return Response.json(page([item]))
}
async function ready(name: string) { await waitFor(() => expect(screen.getByRole('button', { name: `${name} 등록` })).toBeEnabled(), { timeout: 5000 }) }
beforeEach(() => { state.fetch.mockReset(); state.roles = ['SALES'] })

it('creates, edits and deletes API quotations with immutable IDs, server amounts and calendar inputs', async () => {
    let rows: typeof quote[] = []
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') { rows = [quote]; return Response.json(quote, { status: 201 }) }
        if (init?.method === 'PATCH') { rows = [{ ...quote, qty: 3, amount: 300 }]; return Response.json(rows[0]) }
        if (init?.method === 'DELETE') { rows = []; return new Response(null, { status: 204 }) }
        return Response.json(page(rows))
    })
    mount(); const user = userEvent.setup(); await ready('견적')
    await user.click(screen.getByRole('button', { name: '견적 등록' }))
    await user.type(screen.getByLabelText('견적번호 *'), 'QT-LIVE')
    await user.selectOptions(screen.getByLabelText('고객사 *'), '90')
    expect(screen.getByLabelText('결제조건(일)')).toHaveValue(60)
    await user.selectOptions(screen.getByLabelText('품목 *'), '7')
    expect(screen.getByLabelText('단가(원) *')).toHaveValue(100)
    expect(screen.getByRole('button', { name: '납기 달력 열기' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '유효기간 달력 열기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByText('견적을 등록했습니다.')
    const post = state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ quotationNo: 'QT-LIVE', customerId: 90, itemId: 7, qty: 1, unitPrice: 100 })
    await user.click(screen.getByTitle('수정'))
    expect(screen.getByLabelText('견적번호 *')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('고객사 *')).toBeDisabled()
    expect(screen.getByLabelText('품목 *')).toBeDisabled()
    await user.clear(screen.getByLabelText('수량 *')); await user.type(screen.getByLabelText('수량 *'), '3')
    await user.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('견적을 수정했습니다.')
    const patch = state.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(String(patch?.[0])).toContain('/quotations/42')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ qty: 3, unitPrice: 100, dueDate: '2026-12-31', validUntil: '2026-12-20' })
    await user.click(screen.getByTitle('삭제')); await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await screen.findByText('삭제했습니다.'); expect(screen.queryByText('QT-LIVE')).not.toBeInTheDocument()
}, 15000)

it('sends a draft and converts only the sent quotation via server actions', async () => {
    let row = quote
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const lookup = options(url); if (lookup) return lookup
        if (init?.method === 'POST' && url.pathname.endsWith('/send')) { row = { ...quote, status: '발송완료' }; return Response.json(row) }
        if (init?.method === 'POST') { row = { ...quote, status: '수주완료' }; return Response.json({ ...order, quotationId: 42, quotationNo: 'QT-LIVE' }, { status: 201 }) }
        return Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('QT-LIVE')
    expect(screen.queryByRole('button', { name: '수주 전환' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '발송' }))
    await user.click(screen.getByRole('button', { name: '발송 확인' }))
    await screen.findByText('견적을 발송완료 상태로 변경했습니다.')
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '수주 전환' }))
    await user.click(screen.getByRole('button', { name: '수주 전환 확인' }))
    await screen.findByText('수주를 생성했습니다: SO-LIVE')
    expect(screen.getByRole('link', { name: '수주 보기' })).toHaveAttribute('href', '/sales/orders')
    expect(state.fetch.mock.calls.some(([url]) => String(url).includes('/sales-orders/from-quotation/42'))).toBe(true)
    expect(screen.queryByRole('button', { name: '수주 전환' })).not.toBeInTheDocument()
})

it('confirms an order and displays the generated work order without allowing later simple cancellation', async () => {
    let row = order
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') { row = { ...order, status: '확정', workOrderNos: ['WO-LIVE'] }; return Response.json({ salesOrder: row, workOrderNo: 'WO-LIVE', workOrderId: 81 }) }
        return Response.json(page([row]))
    })
    mount(true); const user = userEvent.setup(); await screen.findByText('SO-LIVE')
    await user.click(screen.getByRole('button', { name: '수주 확정' })); await user.click(screen.getByRole('button', { name: '수주 확정 확인' }))
    await screen.findByText('작업오더를 생성했습니다: WO-LIVE'); await screen.findByText('WO-LIVE')
    expect(screen.getByRole('link', { name: '작업오더 보기' })).toHaveAttribute('href', '/production/orders?keyword=WO-LIVE')
    expect(screen.queryByRole('button', { name: '수주 취소' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([url]) => String(url).includes('/sales-orders/42/confirm'))).toBe(true)
})

it('creates and partially updates direct orders then cancels them through the API', async () => {
    let rows: typeof order[] = []
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const lookup = options(url); if (lookup) return lookup
        if (init?.method === 'POST') { rows = [{ ...order, status: url.pathname.endsWith('/cancel') ? '취소' : '대기' }]; return Response.json(rows[0], { status: url.pathname.endsWith('/cancel') ? 200 : 201 }) }
        if (init?.method === 'PATCH') { rows = [{ ...order, qty: 3, amount: 300 }]; return Response.json(rows[0]) }
        return Response.json(page(rows))
    })
    mount(true); const user = userEvent.setup(); await ready('수주')
    await user.click(screen.getByRole('button', { name: '수주 등록' }))
    await user.type(screen.getByLabelText('수주번호 *'), 'SO-LIVE')
    await user.selectOptions(screen.getByLabelText('고객사 *'), '90'); await user.selectOptions(screen.getByLabelText('품목 *'), '7')
    await user.click(screen.getByRole('button', { name: '등록' })); await screen.findByText('수주를 등록했습니다.')
    await user.click(screen.getByTitle('수정')); await user.clear(screen.getByLabelText('수량 *')); await user.type(screen.getByLabelText('수량 *'), '3')
    await user.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('수주를 수정했습니다.')
    const patch = state.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ qty: 3, unitPrice: 100, dueDate: '2026-12-31' })
    await user.click(screen.getByRole('button', { name: '수주 취소' })); await user.click(screen.getByRole('button', { name: '수주 취소 확인' }))
    await screen.findByText('수주를 취소했습니다.'); expect(screen.queryByRole('button', { name: '수주 확정' })).not.toBeInTheDocument()
}, 15000)

it('keeps server conflicts and trace IDs visible and supports read failure retry without seeded data', async () => {
    let fail = true
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') return Response.json({ code: 'INVALID_STATE_TRANSITION', message: '다른 사용자가 이미 확정했습니다.', traceId: 'sales-conflict' }, { status: 409 })
        return fail ? Response.json({ code: 'ERROR', traceId: 'sales-read' }, { status: 503 }) : Response.json(page([order]))
    })
    mount(true); const user = userEvent.setup(); await screen.findByText(/서버 오류가 발생했습니다/)
    expect(screen.queryByText('SO-2609-001')).not.toBeInTheDocument(); fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('SO-LIVE')
    await user.click(screen.getByRole('button', { name: '수주 확정' })); await user.click(screen.getByRole('button', { name: '수주 확정 확인' }))
    expect(await screen.findByText('다른 사용자가 이미 확정했습니다.')).toBeInTheDocument()
    expect(screen.getByText('Trace ID: sales-conflict')).toBeInTheDocument(); expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

it.each([false, true])('hides write controls for production viewers (orders=%s)', async orders => {
    state.roles = ['PRODUCTION']
    state.fetch.mockImplementation(async input => options(new URL(String(input))) ?? Response.json(page([orders ? order : quote])))
    mount(orders); await screen.findByText(orders ? 'SO-LIVE' : 'QT-LIVE')
    expect(screen.queryByRole('button', { name: /등록|발송|수주 확정|수주 취소/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument(); expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
})

it('blocks duplicate submission, retains invalid form values and shows field errors with trace IDs', async () => {
    let reply: ((response: Response) => void) | undefined
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'PATCH') return new Promise<Response>(resolve => { reply = resolve })
        return Response.json(page([quote]))
    })
    mount(); const user = userEvent.setup(); await ready('견적'); await user.click(screen.getByTitle('수정'))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('button', { name: /처리 중/ })).toBeDisabled()
    expect(screen.getByLabelText('수량 *')).toBeDisabled()
    expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1)
    reply?.(Response.json({ code: 'INVALID_INPUT', message: '수량 정밀도를 확인하세요.', traceId: 'sales-form',
        errors: [{ field: 'qty', reason: '소수 4자리까지 허용합니다.' }] }, { status: 400 }))
    expect(await screen.findByText('수량 정밀도를 확인하세요.')).toBeInTheDocument()
    expect(screen.getByText('qty: 소수 4자리까지 허용합니다.')).toBeInTheDocument()
    expect(screen.getByText('Trace ID: sales-form')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByLabelText('수량 *')).toHaveValue(2)
})

it('sends list filters, search, sort and pagination to the server', async () => {
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); return options(url) ?? Response.json(page([order], 21, Number(url.searchParams.get('page'))))
    })
    mount(true); const user = userEvent.setup(); await screen.findByText('SO-LIVE')
    await user.selectOptions(screen.getByLabelText('수주 상태 필터'), '대기')
    await user.selectOptions(screen.getByLabelText('고객사 필터'), '90')
    fireEvent.change(screen.getByPlaceholderText('수주번호, 고객사, 품번 검색...'), { target: { value: 'LIVE' } })
    await user.click(within(screen.getByRole('columnheader', { name: /금액/ })).getByRole('button'))
    await user.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => {
        const p = new URL(String(input)).searchParams
        return p.get('keyword') === 'LIVE' && p.get('status') === '대기' && p.get('customerId') === '90' && p.get('sort') === 'amount,asc' && p.get('page') === '1'
    })).toBe(true))
})
