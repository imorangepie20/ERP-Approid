import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import ProductionRouting from './ProductionRouting'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>(), roles: ['ADMIN'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { roles: state.roles },
    core: createHttpClient({ baseUrl: 'https://test.local/api/core', fetch: state.fetch }),
}) }))
const item = { id: 12, itemNo: 'REAL-P-12', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100,
    stock: 0, safetyStock: 0, leadTimeDays: 0 }
const routing = { id: 72, routingNo: 'REAL-RT-72', itemId: 12, itemNo: item.itemNo, itemName: item.name,
    seq: 10, process: '실제 공정', workCenter: 'WC-REAL', stdTime: 0.123, isSubcontract: true }
const page = (content: unknown[]) => ({ content, number: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0 })
function mount() {
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProductionRouting /></QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['ADMIN'] })

it('creates an outsourced routing, updates it to in-house and deletes through the API', async () => {
    let rows: typeof routing[] = []
    state.fetch.mockImplementation(async (input, init) => {
        if (String(input).includes('/items')) return Response.json(page([item]))
        if (init?.method === 'POST') { rows = [routing]; return Response.json(routing, { status: 201 }) }
        if (init?.method === 'PATCH') { rows = [{ ...routing, isSubcontract: false }]; return Response.json(rows[0]) }
        if (init?.method === 'DELETE') { rows = []; return new Response(null, { status: 204 }) }
        return Response.json(page(rows))
    })
    mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: '공정 등록' })).toBeEnabled(), { timeout: 5000 })
    await user.click(screen.getByRole('button', { name: '공정 등록' }))
    await user.type(screen.getByLabelText('공정 번호 *'), 'REAL-RT-72')
    await user.selectOptions(screen.getByLabelText('품목 *'), '12')
    await user.type(screen.getByLabelText('공정명 *'), '실제 공정')
    await user.type(screen.getByLabelText('작업장 *'), 'WC-REAL')
    await user.clear(screen.getByRole('spinbutton', { name: '표준시간(h)' }))
    await user.type(screen.getByRole('spinbutton', { name: '표준시간(h)' }), '0.123')
    await user.selectOptions(screen.getByLabelText('외주 여부 *'), 'true')
    await user.click(screen.getByRole('button', { name: '등록' }))
    expect(await screen.findByText('REAL-RT-72')).toBeInTheDocument()
    expect(JSON.parse(String(state.fetch.mock.calls.find(([, i]) => i?.method === 'POST')?.[1]?.body)))
        .toMatchObject({ itemId: 12, routingNo: 'REAL-RT-72', seq: 10, stdTime: 0.123, isSubcontract: true })
    await user.click(screen.getByTitle('수정'))
    expect(screen.getByLabelText('품목 *')).toBeDisabled()
    expect(screen.getByLabelText('공정 번호 *')).toHaveAttribute('readonly')
    await user.selectOptions(screen.getByLabelText('외주 여부 *'), 'false')
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByText('공정을 수정했습니다.')
    const patched = state.fetch.mock.calls.find(([, i]) => i?.method === 'PATCH')
    expect(String(patched?.[0])).toContain('/routings/72')
    expect(JSON.parse(String(patched?.[1]?.body))).toEqual({ seq: 10, process: '실제 공정', workCenter: 'WC-REAL', stdTime: 0.123, isSubcontract: false })
    await user.click(screen.getByTitle('삭제'))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await screen.findByText('공정을 삭제했습니다.')
    expect(screen.queryByText('REAL-RT-72')).not.toBeInTheDocument()
}, 15000)

it('allows PRODUCTION to edit, reserves deletion for ADMIN and gives viewers read access', async () => {
    state.fetch.mockImplementation(async input => Response.json(page(String(input).includes('/items') ? [item] : [routing])))
    state.roles = ['PRODUCTION']
    const production = mount()
    expect(await screen.findByTitle('수정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '공정 등록' })).toBeInTheDocument()
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    production.unmount()
    state.roles = ['SALES']
    mount()
    expect(await screen.findByText('REAL-RT-72')).toBeInTheDocument()
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument()
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '공정 등록' })).not.toBeInTheDocument()
})

it('keeps referenced routing on delete conflict and displays trace ID', async () => {
    state.fetch.mockImplementation(async (input, init) => {
        if (String(input).includes('/items')) return Response.json(page([item]))
        if (init?.method === 'DELETE') return Response.json({ code: 'ROUTING_IN_USE', message: '작업오더 참조 중', traceId: 'rt-in-use' }, { status: 409 })
        return Response.json(page([routing]))
    })
    mount()
    await userEvent.click(await screen.findByTitle('삭제'))
    await userEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
    expect(await screen.findByText('작업오더 참조 중')).toBeInTheDocument()
    expect(screen.getByText('Trace ID: rt-in-use')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('REAL-RT-72')).toBeInTheDocument()
})

it('sends filter, sort, search and pagination to the server', async () => {
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/items')) return Response.json(page([item]))
        const url = new URL(String(input))
        return Response.json({ ...page([routing]), number: Number(url.searchParams.get('page')), totalElements: 25, totalPages: 3 })
    })
    mount()
    const user = userEvent.setup()
    await screen.findByText('REAL-RT-72')
    await user.selectOptions(screen.getByLabelText('공정 품목 필터'), '12')
    await user.click(screen.getByText('순서', { exact: true }))
    await user.type(screen.getByPlaceholderText('품번, 품목명 검색...'), 'WC')
    await waitFor(() => expect(state.fetch.mock.calls.some(([url]) => {
        const q = new URL(String(url)).searchParams
        return q.get('itemId') === '12' && q.get('sort') === 'seq,asc' && q.get('keyword') === 'WC'
    })).toBe(true))
    await user.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(state.fetch.mock.calls.some(([url]) => new URL(String(url)).searchParams.get('page') === '1')).toBe(true))
})
