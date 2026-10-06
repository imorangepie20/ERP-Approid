import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import MessageContactForm from './MessageContactForm'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['ACCOUNTING'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const registered = () => ({ contact: { id: 3, partnerId: 9, email: 'billing@example.test', permission: 'ALLOWED', version: 1 } })
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MessageContactForm partnerId={9} partnerName="실제 고객" /></QueryClientProvider>) }
beforeEach(() => { state.roles = ['ACCOUNTING']; state.fetch.mockReset() })

it('shows the registered contact and saves an allowed address with confirmation note', async () => {
    state.fetch.mockResolvedValue(Response.json(registered()))
    mount()
    expect(await screen.findByDisplayValue('billing@example.test')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('수신 이메일'))
    await user.type(screen.getByLabelText('수신 이메일'), 'new@example.test')
    await user.type(screen.getByLabelText('수신 확인 근거'), '담당자 수신 확인')
    await user.click(screen.getByRole('checkbox', { name: '수신자가 업무 안내 수신을 확인했습니다.' }))
    state.fetch.mockResolvedValueOnce(json({ contact: { ...registered().contact, email: 'new@example.test', version: 2 } }, 200))
    await user.click(screen.getByRole('button', { name: '연락처 저장' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const [, init] = state.fetch.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ email: 'new@example.test', permission: 'ALLOWED', acknowledged: true })
})

it('shows unregistered state and blocks sending without an allowed contact', async () => {
    state.fetch.mockResolvedValue(Response.json({ contact: null }))
    mount()
    expect(await screen.findByText('등록된 독촉 수신 주소가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('허용된 연락처가 있어야 발송을 요청할 수 있습니다.')).toBeInTheDocument()
})

it('shows a version-conflict notice and reloads the current contact', async () => {
    state.fetch.mockResolvedValue(Response.json(registered()))
    mount()
    await screen.findByDisplayValue('billing@example.test')
    state.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'DUPLICATE', message: '충돌' }), { status: 409, headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'trace-conflict' } }))
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('수신 확인 근거'), '근거')
    await user.click(screen.getByRole('checkbox', { name: '수신자가 업무 안내 수신을 확인했습니다.' }))
    await user.click(screen.getByRole('button', { name: '연락처 저장' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    expect(await screen.findByText('다른 담당자가 먼저 변경했습니다. 최신 정보를 다시 확인하세요.')).toBeInTheDocument()
})

it('shows read-only contact state to SALES without save controls', async () => {
    state.roles = ['SALES']
    state.fetch.mockResolvedValue(Response.json(registered()))
    mount()
    expect(await screen.findByDisplayValue('billing@example.test')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '연락처 저장' })).not.toBeInTheDocument()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
