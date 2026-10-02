import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../api/http'
import ItemBom from './ItemBom'

const state = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>(), roles: ['ADMIN'] }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({
    user: { roles: state.roles }, core: createHttpClient({ baseUrl: 'https://test.local/api/core', fetch: state.fetch }),
}) }))
const item = { id: 1, itemNo: 'REAL-P-01', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100,
    stock: 0, safetyStock: 0, leadTimeDays: 0 }
const child = { ...item, id: 9, itemNo: 'REAL-M-09', name: '실제 자재', itemType: '자재', unit: 'KG' }
const bom = { id: 42, bomNo: 'REAL-BOM', parentId: 1, parentItemNo: item.itemNo, parentName: item.name,
    childId: 9, childItemNo: child.itemNo, childName: child.name, childUnit: 'KG', childType: '자재',
    qty: 2, lossRate: 5, substituteNo: 'ALT' }
const page = (content: unknown[]) => ({ content, number: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0 })
function mount() {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ItemBom /></QueryClientProvider>)
}
beforeEach(() => { state.fetch.mockReset(); state.roles = ['ADMIN'] })

it('creates, partially edits and deletes real API rows and refreshes the list', async () => {
    let rows: typeof bom[] = []
    state.fetch.mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/items')) return Response.json(page([item, child]))
        if (init?.method === 'POST') { rows = [bom]; return Response.json(bom, { status: 201 }) }
        if (init?.method === 'PATCH') { rows = [{ ...bom, qty: 3, substituteNo: '' }]; return Response.json(rows[0]) }
        if (init?.method === 'DELETE') { rows = []; return new Response(null, { status: 204 }) }
        return Response.json(page(rows))
    })
    mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'BOM 등록' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'BOM 등록' }))
    await user.type(screen.getByLabelText('BOM 번호 *'), 'REAL-BOM')
    await user.selectOptions(screen.getByLabelText('모품목 *'), '1')
    await user.selectOptions(screen.getByLabelText('자품목 *'), '9')
    await user.click(screen.getByRole('button', { name: '등록' }))
    expect(await screen.findByText('REAL-BOM')).toBeInTheDocument()
    const post = state.fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ bomNo: 'REAL-BOM', parentId: 1, childId: 9, qty: 1 })
    await user.click(screen.getByTitle('수정'))
    expect(screen.getByLabelText('BOM 번호 *')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('모품목 *')).toBeDisabled()
    await user.clear(screen.getByLabelText('소요량 *'))
    await user.type(screen.getByLabelText('소요량 *'), '3')
    await user.clear(screen.getByLabelText('대체자재 품번'))
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByText('BOM을 수정했습니다.')
    const patch = state.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(String(patch?.[0])).toContain('/boms/42')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ qty: 3, lossRate: 5, substituteNo: '' })
    await user.click(screen.getByTitle('삭제'))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await screen.findByText('BOM을 삭제했습니다.')
    expect(screen.queryByText('REAL-BOM')).not.toBeInTheDocument()
})

it('shows server conflict and trace ID while keeping the form open', async () => {
    state.fetch.mockImplementation(async (input, init) => {
        if (String(input).includes('/items')) return Response.json(page([item, child]))
        if (init?.method === 'PATCH') return Response.json({ code: 'BOM_CYCLE', message: '순환 참조', traceId: 'bom-conflict' }, { status: 409 })
        return Response.json(page([bom]))
    })
    mount()
    const user = userEvent.setup()
    await user.click(await screen.findByTitle('수정'))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('순환 참조')).toBeInTheDocument()
    expect(screen.getByText('Trace ID: bom-conflict')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('has no memory fallback when fetching BOM fails and can retry', async () => {
    let failing = true
    state.fetch.mockImplementation(async input => {
        if (String(input).includes('/items')) return Response.json(page([item]))
        return failing ? Response.json({ code: 'UPSTREAM_UNAVAILABLE', message: '조회 실패', traceId: 'bom-read' }, { status: 503 })
            : Response.json(page([bom]))
    })
    mount()
    expect(await screen.findByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
    expect(screen.queryByText('BOM-001')).not.toBeInTheDocument()
    failing = false
    await userEvent.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(await screen.findByText('REAL-BOM')).toBeInTheDocument()
})
