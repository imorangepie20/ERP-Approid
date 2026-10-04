import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { createHttpClient } from '../../api/http'
import { mrpFixture, mrpPurchaseFixture } from '../../test/mrpFixture'
import PurchaseMrp from './PurchaseMrp'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof globalThis.fetch>(), roles: ['MATERIAL'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ core: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: state.fetch }), user: { roles: state.roles } }) }))
function selection(input: RequestInfo | URL) {
    const path = new URL(String(input)).pathname
    const page = (content: unknown[]) => Response.json({ content, number: 0, size: 100, totalElements: 1, totalPages: 1 })
    if (path.endsWith('/items')) return page([{ id: 7, itemNo: 'M-LIVE', name: '실제 자재', itemType: '자재', unit: 'kg', price: 100, stock: 10, safetyStock: 2, leadTimeDays: 4 }])
    if (path.endsWith('/partners')) return page([{ id: 8, partnerNo: 'V-LIVE', name: '실제 공급사', partnerType: '발주처', bizNo: '123-45-67890', paymentTerms: 30, leadTimeDays: 4 }])
}
function mount(entry = '/purchase/mrp') {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PurchaseMrp /></MemoryRouter>
    </QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['MATERIAL'] })
it('accepts the real inventory drill-down item filter', async () => {
    state.fetch.mockImplementation(async input => selection(input) ?? Response.json(mrpFixture()))
    mount('/purchase/mrp?itemId=7'); await screen.findByText('63.55 kg')
    await waitFor(() => expect(screen.getByLabelText('표시 품목')).toHaveValue('7'))
    expect(state.fetch.mock.calls.some(([u]) => new URL(String(u)).pathname.endsWith('/analytics/mrp/suggestions') && new URL(String(u)).searchParams.get('itemId') === '7')).toBe(true)
})
it('displays real netting, units and coverage notes with accessible calendar/table', async () => {
    state.fetch.mockImplementation(async input => selection(input) ?? Response.json(mrpFixture()))
    const { container } = mount()
    await screen.findByText('63.55 kg')
    expect(screen.getAllByText('51.55 kg')).toHaveLength(2)
    expect(screen.getByText(/구성품 불출 이력/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계획 종료일 달력 열기' })).toBeEnabled()
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
})
it('requires an explicit vendor then persists a real PO, recalculates coverage and never writes stock', async () => {
    let converted = false
    state.fetch.mockImplementation(async (input, init) => {
        const selected = selection(input); if (selected) return selected
        if (init?.method === 'POST') { converted = true; return Response.json(mrpPurchaseFixture(), { status: 201 }) }
        const d = mrpFixture(); if (converted) Object.assign(d.rows[0], { onOrder: 57.55, netRequirement: 0, suggestedPurchaseQty: 0, action: 'EXPEDITE' })
        return Response.json(d)
    })
    const { container } = mount(); const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: '발주 전환' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '발주 전환' }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByLabelText('발주처 *')).toHaveValue('')
    expect(within(modal).getByLabelText('제안 수량 (kg) *')).toHaveAttribute('readonly')
    expect(within(modal).getByLabelText('제안 수량 (kg) *')).toHaveValue(51.55)
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations).toEqual([])
    await user.selectOptions(within(modal).getByLabelText('발주처 *'), '8')
    fireEvent.change(within(modal).getByLabelText('배송 예정일 *'), { target: { value: '2026-10-20' } })
    await user.click(within(modal).getByRole('button', { name: '발주 확정' }))
    await screen.findByText(/PO-MRP-LIVE · 실제 공급사/)
    await screen.findByText('공급 납기 조정 필요')
    const writes = state.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(String(writes[0][0])).toMatch(/\/purchase-orders$/)
    expect(JSON.parse(String(writes[0][1]?.body))).toMatchObject({ vendorId: 8, itemId: 7, qty: 51.55, unitPrice: 100, dueDate: '2026-10-20' })
    expect(screen.queryByRole('button', { name: '발주 전환' })).not.toBeInTheDocument()
})
it('keeps sales users read-only and applies server filters on requery', async () => {
    state.roles = ['SALES']
    state.fetch.mockImplementation(async input => selection(input) ?? Response.json(mrpFixture()))
    mount(); await screen.findByText('63.55 kg')
    expect(screen.queryByRole('button', { name: '발주 전환' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('표시 품목')).toBeEnabled())
    await userEvent.selectOptions(screen.getByLabelText('표시 품목'), '7')
    fireEvent.change(screen.getByLabelText('계획 종료일'), { target: { value: '2026-12-01' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '계획 재조회' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: '계획 재조회' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([u]) => String(u).includes('through=2026-12-01') && String(u).includes('itemId=7'))).toBe(true))
    expect(state.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('shows loading and traceable errors, retries and displays a genuine empty plan', async () => {
    let resolve: (r: Response) => void = () => {}
    state.fetch.mockImplementation(async input => selection(input) ?? new Promise<Response>(r => { resolve = r }))
    mount(); expect(screen.getByText('MRP를 계산하는 중...')).toBeInTheDocument()
    resolve(Response.json({ code: 'BOM_CYCLE', message: '순환 BOM 확인' }, { status: 409, headers: { 'X-Trace-Id': 'mrp-cycle' } }))
    await screen.findByText('Trace ID: mrp-cycle')
    const d = mrpFixture(); d.rows = []; d.totalElements = 0; d.totalPages = 0
    state.fetch.mockImplementation(async input => selection(input) ?? Response.json(d))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('해당 품목·페이지에 소요량 또는 보충 제안이 없습니다.')
})
it('retains the conversion form and selected vendor on API failure', async () => {
    state.fetch.mockImplementation(async (input, init) => selection(input) ?? (init?.method === 'POST'
        ? Response.json({ code: 'INVALID_INPUT', message: '발주 금액 범위 초과' }, { status: 400, headers: { 'X-Trace-Id': 'mrp-write' } }) : Response.json(mrpFixture())))
    mount(); await waitFor(() => expect(screen.getByRole('button', { name: '발주 전환' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: '발주 전환' }))
    await userEvent.selectOptions(screen.getByLabelText('발주처 *'), '8')
    await userEvent.click(screen.getByRole('button', { name: '발주 확정' }))
    await screen.findByText('Trace ID: mrp-write')
    expect(screen.getByLabelText('발주처 *')).toHaveValue('8')
    expect(screen.getByRole('button', { name: '발주 확정' })).toBeEnabled()
})
