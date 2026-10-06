import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import PurchaseOrders from './PurchaseOrders'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['MATERIAL'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const po = (overrides = {}) => ({ id: 11, purchaseOrderNo: 'PO-LIVE', vendorId: 3, vendorName: '실제 공급사',
    itemId: 7, itemNo: 'RM-LIVE', itemName: '실제 자재', qty: 600, receivedQty: 100, unitPrice: 1200, amount: 720000,
    dueDate: '2026-10-20', status: '부분입고', ...overrides })
const page = (content: unknown[]) => ({ content, number: 0, size: 10, totalElements: content.length, totalPages: 1 })
const vendorPage = () => ({ content: [{ id: 3, partnerNo: 'V-001', name: '실제 공급사', partnerType: '발주처',
    contactName: '담당', contact: '010-0000-0000', paymentTerms: 30, leadTimeDays: 7 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
const itemPage = () => ({ content: [{ id: 7, itemNo: 'RM-LIVE', name: '실제 자재', spec: '', category: '',
    itemType: '자재', unit: 'EA', price: 1200, stock: 50, safetyStock: 10, leadTimeDays: 3 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/purchase/orders']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PurchaseOrders /></MemoryRouter></QueryClientProvider>) }
function mockReads(rows: unknown[] = [po()]) {
    state.fetch.mockImplementation(async (input) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page(rows))
        if (url.pathname.endsWith('/partners')) return Response.json(vendorPage())
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    return { orders: () => Response.json(page(rows)), vendors: () => Response.json(vendorPage()), items: () => Response.json(itemPage()) }
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['MATERIAL'] })

it('lists real orders with remaining quantities from the server page', async () => {
    mockReads(); mount()
    await screen.findByText('PO-LIVE')
    expect(screen.getByText(/잔량 500/)).toBeInTheDocument()
    expect(screen.getByText(/실제 DB 기준/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '입고 화면으로 이동' })).toHaveAttribute('href', '/purchase/receiving?purchaseOrderId=11')
    expect(state.fetch.mock.calls.some(([input]) => String(input).includes('purchase-orders?page=0'))).toBe(true)
})

it('creates an order with master vendor and item IDs then refetches the list', async () => {
    mockReads([]); mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: '발주 등록' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '발주 등록' }))
    await user.clear(screen.getByLabelText('발주번호 *')); await user.type(screen.getByLabelText('발주번호 *'), 'PO-2610-009')
    await user.selectOptions(screen.getByLabelText('발주처 *'), '3')
    await user.selectOptions(screen.getByLabelText('품목 *'), '7')
    await user.clear(screen.getByLabelText('발주수량 *')); await user.type(screen.getByLabelText('발주수량 *'), '600')
    await user.clear(screen.getByLabelText('단가(원) *')); await user.type(screen.getByLabelText('단가(원) *'), '1200')
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST' && url.pathname.endsWith('/purchase-orders')) return json(po({ purchaseOrderNo: 'PO-2610-009', status: '발주', receivedQty: 0 }), 201)
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([po({ purchaseOrderNo: 'PO-2610-009', status: '발주', receivedQty: 0 })]))
        if (url.pathname.endsWith('/partners')) return Response.json(vendorPage())
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByText(/발주를 등록했습니다/)
    const [, init] = state.fetch.mock.calls.find(([input, i]) => String(input).endsWith('/purchase-orders') && i?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toEqual({ purchaseOrderNo: 'PO-2610-009', vendorId: 3, itemId: 7, qty: 600, unitPrice: 1200, dueDate: expect.any(String) })
})

it('edits and deletes only open orders and cancels partial ones', async () => {
    mockReads([po({ status: '발주', receivedQty: 0 })]); mount()
    const user = userEvent.setup()
    await screen.findByText('PO-LIVE')
    await user.click(screen.getByTitle('수정'))
    await user.clear(screen.getByLabelText('발주수량 *')); await user.type(screen.getByLabelText('발주수량 *'), '700')
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'PATCH') return Response.json(po({ status: '발주', receivedQty: 0, qty: 700, amount: 840000 }))
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([po({ status: '발주', receivedQty: 0, qty: 700 })]))
        if (url.pathname.endsWith('/partners')) return Response.json(vendorPage())
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByText(/발주를 수정했습니다/)
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'DELETE') return new Response(null, { status: 204 })
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([]))
        if (url.pathname.endsWith('/partners')) return Response.json(vendorPage())
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByTitle('삭제'))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await screen.findByText(/발주를 삭제했습니다/)
})

it('shows server conflict with trace when a received order cannot change', async () => {
    mockReads(); mount()
    const user = userEvent.setup()
    await screen.findByText('PO-LIVE')
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST' && url.pathname.endsWith('/cancel')) {
            return new Response(JSON.stringify({ code: 'PURCHASE_ORDER_CLOSED', message: '종료된 발주는 취소할 수 없습니다.' }),
                { status: 409, headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'trace-po-cancel' } })
        }
        if (url.pathname.endsWith('/purchase-orders')) return Response.json(page([po()]))
        if (url.pathname.endsWith('/partners')) return Response.json(vendorPage())
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByRole('button', { name: '발주 취소' }))
    await user.click(screen.getByRole('button', { name: '취소 확인' }))
    await screen.findByText(/Trace ID: trace-po-cancel/)
})

it('restricts writes by role without hiding the real list', async () => {
    state.roles = ['ADMIN']; mockReads(); const admin = mount()
    await screen.findByText('PO-LIVE')
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '발주 등록' })).toBeEnabled()
    admin.unmount()
    state.roles = ['SALES']; mount()
    await screen.findByText('PO-LIVE')
    expect(screen.queryByRole('button', { name: '발주 등록' })).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
