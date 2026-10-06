import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import ProductionPlan from './ProductionPlan'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['PRODUCTION'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const plan = (overrides = {}) => ({ id: 7, planNo: 'PL-2611-001', itemId: 9, itemNo: 'FG-LIVE',
    itemName: '실제 제품', planMonth: '2026-11', planQty: 400, orderQty: 320, stockQty: 60, gapQty: 20, status: '계획', ...overrides })
const page = (content: unknown[]) => ({ content, number: 0, size: 10, totalElements: content.length, totalPages: 1 })
const itemPage = () => ({ content: [{ id: 9, itemNo: 'FG-LIVE', name: '실제 제품', spec: '', category: '',
    itemType: '제품', unit: 'EA', price: 5000, stock: 60, safetyStock: 10, leadTimeDays: 3 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/production/plan']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProductionPlan /></MemoryRouter></QueryClientProvider>) }
function mockReads(rows: unknown[] = [plan()]) {
    state.fetch.mockImplementation(async (input) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/production-plans')) return Response.json(page(rows))
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['PRODUCTION'] })

it('lists real plans from the server page with gap quantities', async () => {
    mockReads(); mount()
    await screen.findByText('PL-2611-001')
    expect(screen.getByText(/실제 DB 기준/)).toBeInTheDocument()
    expect(screen.getByText('+20')).toBeInTheDocument()
    expect(state.fetch.mock.calls.some(([input]) => String(input).includes('production-plans?page=0'))).toBe(true)
})

it('creates a plan with master item IDs then refetches the list', async () => {
    mockReads([]); mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: '계획 등록' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '계획 등록' }))
    await user.clear(screen.getByLabelText('계획번호 *')); await user.type(screen.getByLabelText('계획번호 *'), 'PL-2611-001')
    await user.selectOptions(screen.getByLabelText('품목 *'), '9')
    await user.clear(screen.getByLabelText('계획월 *')); await user.type(screen.getByLabelText('계획월 *'), '2026-11')
    await user.clear(screen.getByLabelText('계획수량 *')); await user.type(screen.getByLabelText('계획수량 *'), '400')
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST' && url.pathname.endsWith('/production-plans')) return Response.json(plan(), { status: 201 })
        if (url.pathname.endsWith('/production-plans')) return Response.json(page([plan()]))
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByText(/계획을 등록했습니다. PL-2611-001/)
})

it('confirms a draft plan through a confirmation dialog', async () => {

    mockReads([plan()]); mount()
    const user = userEvent.setup()
    await screen.findByText('PL-2611-001')
    await user.click(screen.getByRole('button', { name: '확정' }))
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST' && url.pathname.endsWith('/production-plans/7/confirm')) {
            return Response.json(plan({ status: '확정' }))
        }
        if (url.pathname.endsWith('/production-plans')) return Response.json(page([plan({ status: '확정' })]))
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await user.click(screen.getByRole('button', { name: '확정 확인' }))
    await screen.findByText(/계획을 확정했습니다. PL-2611-001/)
})

const suggestion = () => ({ itemId: 9, itemNo: 'FG-LIVE', itemName: '실제 제품', planMonth: '2026-11',
    dueCutoff: '2026-11-30', orderBacklogQty: 120, currentStock: 60, safetyStock: 20,
    suggestedPlanQty: 80, suggestedGapQty: 80, openOrderCount: 2,
    orders: [{ orderId: 31, salesOrderNo: 'SO-LIVE-1', dueDate: '2026-11-10', orderQty: 100, shippedQty: 0, remainingQty: 100 },
        { orderId: 32, salesOrderNo: 'SO-LIVE-2', dueDate: '2026-11-20', orderQty: 50, shippedQty: 30, remainingQty: 20 }],
    notes: ['대상은 납기가 계획월 말일 이전인 확정/생산중 수주입니다.'] })

it('suggests quantities from backlog evidence and records the basis on create', async () => {
    mockReads([]); mount()
    const user = userEvent.setup()
    let posted: unknown = null
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/production-plans/suggest')) return Response.json(suggestion())
        if (init?.method === 'POST' && url.pathname.endsWith('/production-plans')) {
            posted = JSON.parse(String(init.body))
            return Response.json(plan(), { status: 201 })
        }
        if (url.pathname.endsWith('/production-plans')) return Response.json(page([]))
        if (url.pathname.endsWith('/items')) return Response.json(itemPage())
        throw new Error(`unexpected ${url.pathname}`)
    })
    await waitFor(() => expect(screen.getByRole('button', { name: '계획 등록' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '계획 등록' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.selectOptions(dialog.getByLabelText('품목 *'), '9')
    await user.click(dialog.getByRole('button', { name: '수량 산출' }))
    await dialog.findByText(/수주잔량 120 \+ 안전재고/)
    expect(dialog.getByLabelText('계획수량 *')).toHaveValue(80)
    expect(dialog.getByLabelText('수주수량')).toHaveValue(120)
    expect(dialog.getByLabelText('현재고')).toHaveValue(60)
    expect(dialog.getByLabelText('생산필요량')).toHaveValue(80)
    await user.click(dialog.getByRole('button', { name: '등록' }))
    await screen.findByText(/계획을 등록했습니다. PL-2611-001/)
    expect(posted).toMatchObject({ planQty: 80, orderQty: 120, stockQty: 60, gapQty: 80 })
    expect(String((posted as Record<string, unknown>).basisNote)).toContain('수주잔량 120')
})
