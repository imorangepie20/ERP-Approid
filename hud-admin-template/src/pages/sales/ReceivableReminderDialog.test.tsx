import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import ReceivableReminderDialog from './ReceivableReminderDialog'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['ACCOUNTING'], close: vi.fn() }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: state.roles }, core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }) }) }))
const row = () => ({ id: 7, receivableNo: 'RV-LIVE', customerId: 9, customerName: '실제 고객', salesOrderId: null, salesOrderNo: null,
    amount: 100, collectedAmount: 30, openingCollectedAmount: 0, remainingAmount: 70, dueDate: '2026-10-01', overdueDays: 3, status: '미수', overdue: true, referenceDate: '2026-10-04' })
const preview = () => ({ receivable: row(), contactName: '마스터 담당자', contact: 'recipient@example.test' as string | null,
    emailSubject: 'Payment reminder', emailBody: 'Body', emailDispatchEnabled: false, snapshotHash: 'b'.repeat(64), messageContact: null })
const page = () => ({ content: [row()], number: 0, size: 10, totalElements: 1, totalPages: 1 })
const respond = (input: RequestInfo | URL) => Response.json(new URL(String(input)).pathname.endsWith('/reminder-preview') ? preview() : page())
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ReceivableReminderDialog onClose={state.close} /></QueryClientProvider>) }
beforeEach(() => { state.roles = ['ACCOUNTING']; state.close.mockReset(); state.fetch.mockReset(); state.fetch.mockImplementation(async input => respond(input)) })
async function select(user: ReturnType<typeof userEvent.setup>) { await user.click(await screen.findByRole('radio', { name: /RV-LIVE/ })); await screen.findByLabelText('수신 주소 또는 번호') }

it('selects a real overdue document and previews remaining balance and master contact; confirms without sending', async () => {
    mount(); const user = userEvent.setup(); await select(user)
    expect(screen.getByLabelText('수신 주소 또는 번호')).toHaveValue('recipient@example.test')
    expect(screen.getByText(/마스터 담당자/)).toBeInTheDocument()
    expect(screen.getByLabelText('독촉 내용 미리보기')).toHaveTextContent('현재 미수 잔액: 70원')
    const dialog = screen.getByRole('dialog', { name: '독촉 발송 검토' })
    expect((await axe.run(dialog, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
    await user.click(screen.getByRole('checkbox', { name: '수신 대상과 내용을 확인했습니다.' }))
    await user.click(screen.getByRole('button', { name: '미리보기 확인' }))
    await screen.findByText('검토 완료 · 미발송')
    expect(screen.getByRole('button', { name: '발송 (준비 중)' })).toBeDisabled()
    expect(state.fetch.mock.calls.filter(([input]) => String(input).includes('/reminder-preview'))).toHaveLength(2)
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    expect(state.close).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '취소 / 닫기' })); expect(state.close).toHaveBeenCalledOnce()
})

it('requires explicit recipient/channel validation and acknowledgment; never guesses missing contact', async () => {
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/reminder-preview')) { const p = preview(); p.contact = null; return Response.json(p) }
        return respond(input)
    })
    mount(); const user = userEvent.setup(); await select(user)
    const address = screen.getByLabelText('수신 주소 또는 번호'), confirm = screen.getByRole('button', { name: '미리보기 확인' })
    expect(address).toHaveValue(''); expect(confirm).toBeDisabled()
    await user.type(address, 'not-an-address'); expect(confirm).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('검토용 채널'), 'SMS')
    await user.clear(address); await user.type(address, '010-1234-5678'); expect(confirm).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: '수신 대상과 내용을 확인했습니다.' })); expect(confirm).toBeEnabled()
    await user.click(confirm); await screen.findByText('검토 완료 · 미발송')
    expect(screen.getByLabelText('확인한 수신자')).toHaveTextContent('010-1234-5678')
})

it('invalidates confirmation when fresh balance or contact changed, including a paid document', async () => {
    mount(); const user = userEvent.setup(); await select(user)
    await user.click(screen.getByRole('checkbox', { name: '수신 대상과 내용을 확인했습니다.' }))
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/reminder-preview')) { const p = preview(); p.contact = 'changed@example.test'; Object.assign(p.receivable, { collectedAmount: 100, remainingAmount: 0, status: '수납완료', overdue: false, overdueDays: 0 }); return Response.json(p) }
        return respond(input)
    })
    await user.click(screen.getByRole('button', { name: '미리보기 확인' }))
    await screen.findByText(/미수금 또는 거래처 정보가 변경되었습니다/)
    expect(screen.queryByText('검토 완료 · 미발송')).not.toBeInTheDocument()
    expect(screen.getByText(/현재 날짜 연체 미수 대상이 아닙니다/)).toBeInTheDocument()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})

it('shows preview/recheck errors with trace and only confirms after a successful retry', async () => {
    mount(); const user = userEvent.setup(); await select(user)
    await user.click(screen.getByRole('checkbox', { name: '수신 대상과 내용을 확인했습니다.' }))
    state.fetch.mockImplementation(async input => String(input).includes('/reminder-preview')
        ? Response.json({ code: 'INTERNAL_ERROR', message: '미리보기 조회 실패' }, { status: 500, headers: { 'X-Trace-Id': 'trace-preview' } }) : respond(input))
    await user.click(screen.getByRole('button', { name: '미리보기 확인' }))
    await screen.findByText('Trace ID: trace-preview'); expect(screen.queryByText('검토 완료 · 미발송')).not.toBeInTheDocument()
    state.fetch.mockImplementation(async input => respond(input)); await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByLabelText('수신 주소 또는 번호')
    await user.click(screen.getByRole('checkbox', { name: '수신 대상과 내용을 확인했습니다.' }))
    await user.click(screen.getByRole('button', { name: '미리보기 확인' })); await screen.findByText('검토 완료 · 미발송')
})

it('uses literal server search/pages, clears hidden selection, and exposes empty list without fallback', async () => {
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/reminder-preview')) return respond(input)
        const p = page(); p.totalElements = 11; p.totalPages = 2; p.number = Number(new URL(String(input)).searchParams.get('page')); return Response.json(p)
    })
    mount(); const user = userEvent.setup(); await select(user)
    await user.click(screen.getByRole('button', { name: '다음 독촉 대상' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('page') === '1')).toBe(true))
    expect(screen.queryByLabelText('수신 주소 또는 번호')).not.toBeInTheDocument()
    state.fetch.mockImplementation(async () => Response.json({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 }))
    await user.type(screen.getByLabelText('독촉 대상 검색'), '고객_100%')
    await screen.findByText('날짜 연체 미수 대상이 없습니다.')
    await waitFor(() => expect(state.fetch.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('keyword') === '고객_100%')).toBe(true))
    expect(screen.getByRole('button', { name: '다음 독촉 대상' })).toBeDisabled()
})

it('denies unrelated roles without requests and allows SALES to review without writes', async () => {
    state.roles = ['PRODUCTION']; const denied = mount()
    expect(screen.getByRole('alert')).toHaveTextContent('미수금 조회 권한이 없습니다.'); expect(state.fetch).not.toHaveBeenCalled(); denied.unmount()
    state.roles = ['SALES']; mount(); const user = userEvent.setup(); await select(user)
    expect(screen.getByRole('button', { name: '발송 (준비 중)' })).toBeDisabled()
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
