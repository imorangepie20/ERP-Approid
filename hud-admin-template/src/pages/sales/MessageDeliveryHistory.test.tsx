import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import MessageDeliveryHistory from './MessageDeliveryHistory'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['ACCOUNTING'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const queued = () => ({ content: [{ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', receivableId: 7, state: 'QUEUED', recipient: 'billing@example.test', subject: 'Subject', remainingAmount: 70, requestedAt: '2026-10-04T14:00:00Z', attemptCount: 0, acceptedAt: null, errorCode: null }], number: 0, size: 20, totalElements: 1, totalPages: 1 })
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MessageDeliveryHistory receivableId={7} /></QueryClientProvider>) }
beforeEach(() => { state.roles = ['ACCOUNTING']; state.fetch.mockReset() })

it('lists delivery states with server wording and refetches after retry', async () => {
    state.fetch.mockImplementation(async input => Response.json(String(input).includes('/retry')
        ? { message: { ...queued().content[0], state: 'QUEUED', attemptCount: 1 }, replayed: false }
        : { ...queued(), content: [{ ...queued().content[0], state: 'FAILED', attemptCount: 1, errorCode: 'SMTP_TRANSIENT_FAILURE' }] }))
    mount()
    expect(await screen.findByText(/발송 실패/)).toBeInTheDocument()
    expect(await screen.findByText(/재시도 가능/)).toBeInTheDocument()
    const user = userEvent.setup()
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/retry')) return json({ message: { ...queued().content[0], state: 'QUEUED', attemptCount: 1 }, replayed: false }, 202)
        return Response.json(queued())
    })
    await user.click(screen.getByRole('button', { name: '재시도 요청' }))
    await waitFor(() => expect(state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST').length).toBeGreaterThan(0))
})

it('explains unknown results without offering retry', async () => {
    state.fetch.mockResolvedValue(Response.json({ ...queued(), content: [{ ...queued().content[0], state: 'UNKNOWN', attemptCount: 1, errorCode: 'SMTP_RESULT_UNKNOWN' }] }))
    mount()
    expect(await screen.findByText(/접수 여부 확인 필요/)).toBeInTheDocument()
    expect(await screen.findByText(/재발송 금지/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '재시도 요청' })).not.toBeInTheDocument()
})

it('hides retry controls from SALES while showing history', async () => {
    state.roles = ['SALES']
    state.fetch.mockResolvedValue(Response.json({ ...queued(), content: [{ ...queued().content[0], state: 'FAILED', attemptCount: 1, errorCode: 'SMTP_TRANSIENT_FAILURE' }] }))
    mount()
    expect(await screen.findByText(/발송 실패/)).toBeInTheDocument()
    expect(await screen.findByText(/재시도 가능/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '재시도 요청' })).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
