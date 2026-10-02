import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import ProductionOrders from './ProductionOrders'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['PRODUCTION'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const item = { id: 7, itemNo: 'P-LIVE', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100, stock: 0, safetyStock: 0, leadTimeDays: 3 }
const material = { ...item, id: 8, itemNo: 'M-LIVE', name: '자재', itemType: '자재' }
const order = { id: 42, workOrderNo: 'WO-LIVE', salesOrderId: null as number | null, salesOrderNo: null as string | null,
    itemId: 7, itemNo: item.itemNo, itemName: item.name, qty: 10, goodQty: 0, defectQty: 0, progress: 0,
    startDate: '2026-10-02', dueDate: '2026-12-31', status: '지시', delayed: false, assignee: '', priority: 1,
    plannedTimeHours: 2, subcontractTimeHours: 1,
    routingSteps: [{ routingId: 3, routingNo: 'RT-SNAPSHOT', seq: 1, process: '보관 공정', workCenter: 'WC-A', stdTime: 0.2, isSubcontract: true }] }
const page = (content: unknown[], total = content.length, number = 0) => ({ content, number, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) })
function options(url: URL) { if (url.pathname.endsWith('/items')) return Response.json(page([item, material])) }
function mount(path = '/production/orders') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProductionOrders /></MemoryRouter>
    </QueryClientProvider>)
}
async function ready() { await waitFor(() => expect(screen.getByRole('button', { name: '오더 등록' })).toBeEnabled(), { timeout: 5000 }) }
beforeEach(() => { state.fetch.mockReset(); state.roles = ['PRODUCTION'] })

it('creates, partially edits and deletes independent orders with actual item IDs and calendar fields', async () => {
    let rows: typeof order[] = []
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') { rows = [order]; return Response.json(order, { status: 201 }) }
        if (init?.method === 'PATCH') { rows = [{ ...order, assignee: '김작업', priority: 3 }]; return Response.json(rows[0]) }
        if (init?.method === 'DELETE') { rows = []; return new Response(null, { status: 204 }) }
        return Response.json(page(rows))
    })
    mount(); const user = userEvent.setup(); await ready()
    await user.click(screen.getByRole('button', { name: '오더 등록' }))
    await user.type(screen.getByLabelText('작업오더 번호 *'), 'WO-LIVE')
    expect(within(screen.getByLabelText('품목 *')).queryByRole('option', { name: /M-LIVE/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('품목 *'), '7')
    expect(screen.getByRole('button', { name: '착수일 달력 열기' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '완료예정 달력 열기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '등록' })); await screen.findByText('작업오더를 등록했습니다.')
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body)))
        .toMatchObject({ workOrderNo: 'WO-LIVE', itemId: 7, qty: 1, assignee: '', priority: 1 })
    await user.click(screen.getByTitle('수정'))
    expect(screen.getByLabelText('작업오더 번호 *')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('품목 *')).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '담당자' }), '김작업'); await user.selectOptions(screen.getByLabelText('우선순위 *'), '3')
    await user.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('작업오더를 수정했습니다.')
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body)))
        .toEqual({ qty: 10, startDate: order.startDate, dueDate: order.dueDate, assignee: '김작업', priority: 3 })
    await user.click(screen.getByTitle('삭제')); await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await screen.findByText('작업오더를 삭제했습니다.'); expect(screen.queryByText('WO-LIVE')).not.toBeInTheDocument()
}, 15000)

it('saves cumulative actuals, completes into a Lot and receipt, then closes through server transitions', async () => {
    let row = order
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input)); const lookup = options(url); if (lookup) return lookup
        if (init?.method === 'POST') {
            if (url.pathname.endsWith('/progress')) { row = { ...order, status: '진행중', goodQty: 4, defectQty: 1, progress: 50 }; return Response.json(row) }
            if (url.pathname.endsWith('/complete')) { row = { ...row, status: '완료', goodQty: 8, defectQty: 2, progress: 100 }; return Response.json({ workOrder: row, lotNo: 'LOT-LIVE', inventoryTxnNo: 'TX-LIVE' }) }
            row = { ...row, status: '마감' }; return Response.json(row)
        }
        return Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('WO-LIVE')
    await user.click(screen.getByRole('button', { name: '실적 입력' }))
    await user.clear(screen.getByLabelText('누적 양품 *')); await user.type(screen.getByLabelText('누적 양품 *'), '4')
    await user.clear(screen.getByLabelText('누적 불량 *')); await user.type(screen.getByLabelText('누적 불량 *'), '1')
    await user.click(screen.getByRole('button', { name: '실적 입력 확인' })); await screen.findByText('50%')
    expect(JSON.parse(String(state.fetch.mock.calls.find(([url]) => String(url).endsWith('/progress'))?.[1]?.body))).toEqual({ goodQty: 4, defectQty: 1 })
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '생산완료' }))
    expect(screen.getByLabelText('누적 양품 *')).toHaveValue(4)
    await user.clear(screen.getByLabelText('누적 양품 *')); await user.type(screen.getByLabelText('누적 양품 *'), '8')
    await user.clear(screen.getByLabelText('누적 불량 *')); await user.type(screen.getByLabelText('누적 불량 *'), '2')
    await user.click(screen.getByRole('button', { name: '생산완료 확인' })); await screen.findByText('생산완료 · Lot LOT-LIVE · 입고 TX-LIVE')
    expect(screen.queryByRole('button', { name: '실적 입력' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '마감' })); await user.click(screen.getByRole('button', { name: '마감 확인' }))
    await screen.findByText('작업오더를 마감했습니다.'); expect(screen.queryByRole('button', { name: '생산완료' })).not.toBeInTheDocument()
})

it('has no axe violations in the list, actuals, confirmation and detail dialogs', async () => {
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? order : page([order]))
    })
    const { container } = mount(); const user = userEvent.setup(); await ready(); await screen.findByText('WO-LIVE')
    const check = async (element: HTMLElement) => {
        const result = await axe.run(element, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
        expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.html) }))).toEqual([])
    }
    await check(container)
    await user.click(screen.getByRole('button', { name: '실적 입력' })); await check(screen.getByRole('dialog'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '취소' })); await check(screen.getByRole('alertdialog'))
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await user.click(screen.getByRole('button', { name: '상세' })); await screen.findByText('보관 공정'); await check(screen.getByRole('dialog'))
}, 15000)

it('cancels only an empty independent order and removes terminal write controls', async () => {
    let row = order
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') { row = { ...order, status: '취소' }; return Response.json(row) }
        return Response.json(page([row]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('WO-LIVE')
    await user.click(screen.getByRole('button', { name: '취소' })); await user.click(screen.getByRole('button', { name: '취소 확인' }))
    await screen.findByText('작업오더를 취소했습니다.')
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '실적 입력' })).not.toBeInTheDocument()
})

it('shows authoritative detail routing snapshots and protects linked order quantities', async () => {
    const linked = { ...order, salesOrderId: 9, salesOrderNo: 'SO-LIVE', assignee: '이담당', priority: 2 }
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); return options(url) ?? Response.json(url.pathname.endsWith('/42') ? linked : page([linked]))
    })
    mount(); const user = userEvent.setup(); await ready(); await screen.findByText('SO-LIVE')
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument()
    await user.click(screen.getByTitle('수정')); expect(screen.getByLabelText('지시수량 *')).toHaveAttribute('readonly')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '상세' }))
    expect(await screen.findByText('보관 공정')).toBeInTheDocument(); expect(screen.getByText('계획시간 2h · 외주시간 1h')).toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([url]) => String(url).endsWith('/work-orders/42'))).toBe(true)
})

it('supports read retry and retains actuals, trace and field errors after failed completion', async () => {
    let fail = true
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') return Response.json({ code: 'WORK_ORDER_QTY_MISMATCH', message: '전체 실적을 입력하세요.', traceId: 'wo-error', errors: [{ field: 'goodQty', reason: '합계를 확인하세요.' }] }, { status: 422 })
        return fail ? Response.json({ code: 'ERROR', message: 'error', traceId: 'wo-read' }, { status: 503 }) : Response.json(page([order]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText(/서버 오류가 발생했습니다/)
    expect(screen.queryByText('WO-2610-001')).not.toBeInTheDocument(); fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('WO-LIVE')
    await user.click(screen.getByRole('button', { name: '생산완료' })); await user.click(screen.getByRole('button', { name: '생산완료 확인' }))
    await screen.findByText('전체 실적을 입력하세요.')
    expect(screen.getByText('Trace ID: wo-error')).toBeInTheDocument(); expect(screen.getByText('goodQty: 합계를 확인하세요.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByLabelText('누적 양품 *')).toHaveValue(0)
})

it('prevents repeated completion submissions while pending', async () => {
    let reply: ((r: Response) => void) | undefined
    state.fetch.mockImplementation(async (input, init) => {
        const lookup = options(new URL(String(input))); if (lookup) return lookup
        if (init?.method === 'POST') return new Promise<Response>(resolve => { reply = resolve })
        return Response.json(page([order]))
    })
    mount(); const user = userEvent.setup(); await screen.findByText('WO-LIVE')
    await user.click(screen.getByRole('button', { name: '생산완료' })); await user.click(screen.getByRole('button', { name: '생산완료 확인' }))
    expect(screen.getByRole('button', { name: /처리 중/ })).toBeDisabled(); expect(screen.getByLabelText('누적 양품 *')).toBeDisabled()
    expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    reply?.(Response.json({ code: 'INVALID_STATE_TRANSITION', message: '이미 완료했습니다.' }, { status: 409 }))
    await screen.findByText('이미 완료했습니다.')
})

it.each(['SALES', 'VIEWER'])('keeps %s read-only while allowing detail', async role => {
    state.roles = [role]; state.fetch.mockImplementation(async input => options(new URL(String(input))) ?? Response.json(page([order])))
    mount(); await screen.findByText('WO-LIVE')
    expect(screen.queryByRole('button', { name: /등록|생산완료|실적 입력|마감/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument(); expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '상세' })).toBeEnabled()
})

it('initializes linked navigation search and sends server filters, sorting and pages', async () => {
    state.fetch.mockImplementation(async input => {
        const url = new URL(String(input)); return options(url) ?? Response.json(page([order], 21, Number(url.searchParams.get('page'))))
    })
    mount('/production/orders?keyword=WO-LIVE'); const user = userEvent.setup(); await screen.findByText('WO-LIVE')
    expect(screen.getByPlaceholderText('작업오더, 수주, 품번, 담당자 검색...')).toHaveValue('WO-LIVE')
    await user.selectOptions(screen.getByLabelText('작업오더 상태 필터'), '지시'); await user.selectOptions(screen.getByLabelText('품목 필터'), '7')
    fireEvent.change(screen.getByPlaceholderText('작업오더, 수주, 품번, 담당자 검색...'), { target: { value: 'LIVE' } })
    await user.click(within(screen.getByRole('columnheader', { name: /지시수량/ })).getByRole('button')); await user.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => {
        const p = new URL(String(input)).searchParams
        return p.get('keyword') === 'LIVE' && p.get('status') === '지시' && p.get('itemId') === '7' && p.get('sort') === 'qty,asc' && p.get('page') === '1'
    })).toBe(true))
})
