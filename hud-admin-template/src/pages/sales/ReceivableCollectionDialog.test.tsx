import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import ReceivableCollectionDialog from './ReceivableCollectionDialog'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['ACCOUNTING'], close: vi.fn() }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const row = () => ({ id: 7, receivableNo: 'RV-LIVE', customerId: 9, customerName: '실제 고객', salesOrderId: null, salesOrderNo: null,
    amount: 100, collectedAmount: 0, openingCollectedAmount: 0, remainingAmount: 100, dueDate: '2026-10-01', overdueDays: 3, status: '미수', overdue: true, referenceDate: '2026-10-04' })
const collection = () => ({ id: 12, requestId: '4d0648af-4046-44d2-a6e9-7dff4b202f01', amount: 30, collectedOn: '2026-10-04', remainingAmount: 70, actorId: 1, traceId: 'trace-payment', recordedAt: '2026-10-04T02:00:00Z' })
const detail = () => ({ receivable: row(), collections: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 } })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ReceivableCollectionDialog receivableId={7} onClose={state.close} /></QueryClientProvider>) }
beforeEach(() => { sessionStorage.clear(); state.roles = ['ACCOUNTING']; state.close.mockReset(); state.fetch.mockReset(); state.fetch.mockImplementation(async () => Response.json(detail())) })

it('opens actual history, preserves legacy opening principal and restricts SALES to reading', async () => {
    state.roles = ['SALES']; const d = detail(); Object.assign(d.receivable, { openingCollectedAmount: 100, collectedAmount: 100, remainingAmount: 0, status: '수납완료', overdue: false, overdueDays: 0 })
    state.fetch.mockResolvedValue(Response.json(d)); mount(); const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText(/이월 수납액/)
    expect(within(dialog).getByText(/과거 수납일과 처리자는 확인할 수 없습니다/)).toBeInTheDocument()
    expect(within(dialog).getByText('새 수납 이력이 없습니다.')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('수납 금액')).not.toBeInTheDocument()
    expect((await axe.run(dialog, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})

it('submits partial amount with calendar date and stable UUID; closes only after real success', async () => {
    state.fetch.mockImplementation(async (_input, init) => init?.method === 'POST'
        ? Response.json({ receivable: { ...row(), collectedAmount: 30, remainingAmount: 70 }, collection: { ...collection(), requestId: JSON.parse(String(init.body)).requestId }, replayed: false }) : Response.json(detail()))
    mount(); const user = userEvent.setup(); await screen.findByLabelText('수납 금액')
    await user.type(screen.getByLabelText('수납 금액'), '30')
    expect(screen.getByLabelText('수납일')).toHaveAttribute('type', 'date')
    expect(screen.getByRole('button', { name: '수납일 달력 열기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '수납 저장' }))
    await waitFor(() => expect(state.close).toHaveBeenCalledOnce())
    const [url, init] = state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    const body = JSON.parse(String(init?.body))
    expect(String(url)).toContain('/receivables/7/collect'); expect(body.amount).toBe(30); expect(body.collectedOn).toBe('2026-10-04')
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i)
})

it('retains a lost-response attempt across remount and retries identical data without automatic writes', async () => {
    state.fetch.mockImplementation(async (_input, init) => { if (init?.method === 'POST') throw new TypeError('lost response'); return Response.json(detail()) })
    const first = mount(); const user = userEvent.setup(); await screen.findByLabelText('수납 금액'); await user.type(screen.getByLabelText('수납 금액'), '30')
    await user.click(screen.getByRole('button', { name: '수납 저장' })); await screen.findByText(/처리 결과 미확인/)
    expect(screen.getByLabelText('수납 금액')).toBeDisabled()
    const initialBody = state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')![1]?.body
    first.unmount(); mount(); await screen.findByRole('button', { name: '같은 요청 재시도' })
    expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    state.fetch.mockImplementation(async (_input, init) => init?.method === 'POST'
        ? Response.json({ receivable: { ...row(), collectedAmount: 30, remainingAmount: 70 }, collection: { ...collection(), requestId: JSON.parse(String(initialBody)).requestId }, replayed: true }) : Response.json(detail()))
    await user.click(screen.getByRole('button', { name: '같은 요청 재시도' }))
    await waitFor(() => expect(state.close).toHaveBeenCalledOnce())
    expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')[1][1]?.body).toEqual(initialBody)
    expect(sessionStorage.getItem('erp.collection.pending:1:7')).toBeNull()
})

it('blocks invalid or over-balance amounts and permits full remainder selection', async () => {
    mount(); const user = userEvent.setup(); const input = await screen.findByLabelText('수납 금액')
    await user.type(input, '101'); expect(screen.getByRole('button', { name: '수납 저장' })).toBeDisabled()
    await user.clear(input); await user.type(input, '1.5'); expect(screen.getByRole('button', { name: '수납 저장' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '잔액 전액 입력' })); expect(input).toHaveValue(100)
    expect(screen.getByRole('button', { name: '수납 저장' })).toBeEnabled()
    expect(state.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

it('shows traced read failure and pages actual immutable history', async () => {
    state.roles = ['SALES']; state.fetch.mockResolvedValue(Response.json({ code: 'INTERNAL_ERROR', message: '이력 조회 실패' }, { status: 500, headers: { 'X-Trace-Id': 'trace-history' } }))
    mount(); const user = userEvent.setup(); await screen.findByText('Trace ID: trace-history')
    state.fetch.mockImplementation(async input => {
        const d = detail(); Object.assign(d.receivable, { collectedAmount: 30, remainingAmount: 70 }); const page = Number(new URL(String(input)).searchParams.get('page')); Object.assign(d.collections, { content: [{ ...collection(), id: 12 + page }], totalElements: 21, totalPages: 2, number: page }); return Response.json(d)
    })
    await user.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('사용자 #1')
    await user.click(screen.getByRole('button', { name: '다음 수납 이력' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('page') === '1')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: '다음 수납 이력' })).toBeDisabled())
})
