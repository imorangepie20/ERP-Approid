import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../../auth/AuthContext'
import { saveSession } from '../../auth/session'
import Items from './Items'

const env = {
    VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
}

const item = {
    id: 7,
    itemNo: 'M-S002',
    name: '파이프 Ø48.6',
    spec: 'STKR-400 t2.0',
    category: '소재',
    itemType: '자재',
    unit: 'M',
    price: 9200,
    stock: 1450,
    safetyStock: 500,
    leadTimeDays: 7,
}

const secondItem = {
    ...item,
    id: 8,
    itemNo: 'P-Z999',
    name: '두 번째 페이지 품목',
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    const promise = new Promise<T>(next => { resolve = next })
    return { promise, resolve }
}

function page(content = [item], overrides: Record<string, unknown> = {}) {
    return {
        content,
        number: 0,
        size: 10,
        totalElements: content.length,
        totalPages: content.length === 0 ? 0 : 1,
        ...overrides,
    }
}

function renderItems(fetchMock: typeof fetch, path = '/items') {
    saveSession(sessionStorage, 'access-token', 3600)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider env={env} storage={sessionStorage} fetch={fetchMock}>
                <MemoryRouter initialEntries={[path]}><Items /></MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>,
    )
}

function createFetchMock(
    itemHandler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
    roles = ['ADMIN'],
) {
    return vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/auth/me')) {
            return Response.json({
                id: 1,
                username: 'user',
                name: '테스트 사용자',
                roles,
            })
        }
        if (url.pathname.includes('/items')) return itemHandler(url, init)
        throw new Error(`예상하지 못한 요청: ${url}`)
    })
}

function itemRequests(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
    return fetchMock.mock.calls.filter(([input, init]) => (
        new URL(String(input)).pathname.endsWith('/items')
        && (init?.method ?? 'GET') === 'GET'
    ))
}

describe('Items', () => {
    beforeEach(() => sessionStorage.clear())

    it('loads authenticated server data with a stable default sort and distinct item number', async () => {
        const fetchMock = createFetchMock(() => Response.json(page()))
        renderItems(fetchMock)

        expect(screen.getByRole('status')).toHaveTextContent('품목을 불러오는 중')
        expect(await screen.findByText('M-S002')).toBeInTheDocument()
        expect(screen.getByText('파이프 Ø48.6')).toBeInTheDocument()
        expect(screen.getByText('총 1품목 · 현재 페이지 미달 0건')).toBeInTheDocument()

        const [requestUrl, requestInit] = itemRequests(fetchMock)[0]
        const url = new URL(String(requestUrl))
        expect(url.searchParams.get('page')).toBe('0')
        expect(url.searchParams.get('size')).toBe('10')
        expect(url.searchParams.get('sort')).toBe('itemNo,asc')
        expect(new Headers(requestInit?.headers).get('Authorization')).toBe('Bearer access-token')

        const createButton = screen.getByRole('button', { name: '품목 등록' })
        expect(createButton).toBeEnabled()
        expect(screen.getAllByTitle(/수정|삭제/)).toHaveLength(2)
    })

    it('converts UI pages to zero-based server pages and resets to page one for debounced search', async () => {
        const fetchMock = createFetchMock(url => {
            const serverPage = Number(url.searchParams.get('page'))
            return Response.json(page([item], {
                number: serverPage,
                totalElements: 12,
                totalPages: 2,
            }))
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        fireEvent.click(screen.getByRole('button', { name: '2' }))
        await waitFor(() => {
            const requests = itemRequests(fetchMock)
            const request = requests[requests.length - 1]
            expect(new URL(String(request?.[0])).searchParams.get('page')).toBe('1')
        })

        fireEvent.change(screen.getByPlaceholderText('품번, 품명 검색...'), {
            target: { value: ' 파이프 ' },
        })
        await waitFor(() => {
            const requests = itemRequests(fetchMock)
            const request = requests[requests.length - 1]
            const url = new URL(String(request?.[0]))
            expect(url.searchParams.get('keyword')).toBe('파이프')
            expect(url.searchParams.get('page')).toBe('0')
        }, { timeout: 1_000 })
    })

    it('does not relabel stale rows while a new page response is pending', async () => {
        const nextPage = deferred<Response>()
        const fetchMock = createFetchMock(url => {
            if (url.searchParams.get('page') === '1') return nextPage.promise
            return Response.json(page([item], { totalElements: 11, totalPages: 2 }))
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        fireEvent.click(screen.getByRole('button', { name: '2' }))
        await waitFor(() => expect(itemRequests(fetchMock)).toHaveLength(2))
        expect(screen.queryByText('M-S002')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('품목을 불러오는 중')
        expect(screen.queryByText('11~11 / 총 11건')).not.toBeInTheDocument()

        await act(async () => {
            nextPage.resolve(Response.json(page([secondItem], {
                number: 1,
                totalElements: 11,
                totalPages: 2,
            })))
        })
        expect(await screen.findByText('P-Z999')).toBeInTheDocument()
        expect(screen.getByText('11~11 / 총 11건')).toBeInTheDocument()
    })

    it('does not keep rows from the previous sort while the sorted response is pending', async () => {
        const sortedPage = deferred<Response>()
        const fetchMock = createFetchMock(url => {
            if (url.searchParams.get('sort') === 'itemNo,desc') return sortedPage.promise
            return Response.json(page([item]))
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        fireEvent.click(screen.getByRole('button', { name: '품번 정렬' }))
        await waitFor(() => expect(itemRequests(fetchMock)).toHaveLength(2))
        expect(screen.queryByText('M-S002')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('품목을 불러오는 중')

        await act(async () => {
            sortedPage.resolve(Response.json(page([secondItem])))
        })
        expect(await screen.findByText('P-Z999')).toBeInTheDocument()
    })

    it('filters by itemType on the server and omits the parameter for all types', async () => {
        const fetchMock = createFetchMock(() => Response.json(page()))
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        expect(new URL(String(itemRequests(fetchMock)[0][0])).searchParams.has('itemType')).toBe(false)
        fireEvent.change(screen.getByRole('combobox', { name: '품목 유형' }), {
            target: { value: '자재' },
        })

        await waitFor(() => {
            const requests = itemRequests(fetchMock)
            const url = new URL(String(requests[requests.length - 1][0]))
            expect(url.searchParams.get('itemType')).toBe('자재')
            expect(url.searchParams.get('page')).toBe('0')
        })
        expect(screen.queryByRole('button', { name: '필터' })).not.toBeInTheDocument()
    })

    it('accepts an out-of-range empty page and refetches the last valid page', async () => {
        const requestedPages: string[] = []
        const fetchMock = createFetchMock(url => {
            const requestedPage = url.searchParams.get('page') ?? '0'
            requestedPages.push(requestedPage)
            if (requestedPage === '2') {
                return Response.json(page([], {
                    number: 2,
                    totalElements: 11,
                    totalPages: 2,
                }))
            }
            if (requestedPage === '1') {
                return Response.json(page([secondItem], {
                    number: 1,
                    totalElements: 11,
                    totalPages: 2,
                }))
            }
            return Response.json(page([item], { totalElements: 21, totalPages: 3 }))
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        fireEvent.click(screen.getByRole('button', { name: '3' }))

        expect(await screen.findByText('P-Z999')).toBeInTheDocument()
        expect(requestedPages).toEqual(['0', '2', '1'])
        expect(screen.getByText('11~11 / 총 11건')).toBeInTheDocument()
    })

    it('shows API errors with trace ids and retries in place', async () => {
        let attempts = 0
        const fetchMock = createFetchMock(() => {
            attempts += 1
            if (attempts === 1) {
                return Response.json({
                    code: 'ITEM_READ_FAILED',
                    message: '품목 조회 실패',
                    traceId: 'items-trace-1',
                }, { status: 500 })
            }
            return Response.json(page())
        })
        renderItems(fetchMock)

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('서버 오류가 발생했습니다')
        expect(alert).toHaveTextContent('Trace ID: items-trace-1')
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
        expect(await screen.findByText('M-S002')).toBeInTheDocument()
        expect(attempts).toBe(2)
    })

    it('keeps the search controls available for an empty server result', async () => {
        const fetchMock = createFetchMock(() => Response.json(page([])))
        renderItems(fetchMock)

        expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('품번, 품명 검색...')).toBeInTheDocument()
        expect(screen.getByText('데이터 없음')).toBeInTheDocument()
    })

    it('allows an admin to create an item and refreshes the server list', async () => {
        const user = userEvent.setup()
        let createdBody: Record<string, unknown> | undefined
        let listReads = 0
        const fetchMock = createFetchMock(async (url, init) => {
            const method = init?.method ?? 'GET'
            if (url.pathname.endsWith('/items') && method === 'POST') {
                createdBody = JSON.parse(String(init?.body)) as Record<string, unknown>
                return Response.json({ ...item, id: 9, ...createdBody, stock: 0 }, { status: 201 })
            }
            listReads += 1
            return Response.json(page())
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        await user.click(screen.getByRole('button', { name: '품목 등록' }))
        const dialog = screen.getByRole('dialog', { name: '품목 등록' })
        expect(dialog).toBeInTheDocument()
        await user.type(within(dialog).getByLabelText('품번 *'), 'T-001')
        await user.type(within(dialog).getByLabelText('품목명 *'), '신규 품목')
        await user.selectOptions(within(dialog).getByLabelText('유형 *'), '자재')
        await user.type(within(dialog).getByLabelText('단위 *'), 'EA')
        await user.type(within(dialog).getByLabelText('단가 *'), '1200')
        await user.type(within(dialog).getByLabelText('안전재고'), '5')
        await user.type(within(dialog).getByLabelText('리드타임(일)'), '2')
        await user.click(screen.getByRole('button', { name: '등록' }))

        expect(await screen.findByRole('status')).toHaveTextContent('품목을 등록했습니다.')
        expect(createdBody).toMatchObject({
            itemNo: 'T-001',
            name: '신규 품목',
            itemType: '자재',
            unit: 'EA',
            price: 1200,
            safetyStock: 5,
            leadTimeDays: 2,
        })
        expect(listReads).toBeGreaterThan(1)
    })

    it('edits an item without allowing its item number to change', async () => {
        const user = userEvent.setup()
        let updateBody: Record<string, unknown> | undefined
        const fetchMock = createFetchMock(async (url, init) => {
            const method = init?.method ?? 'GET'
            if (url.pathname.endsWith('/items/7') && method === 'PATCH') {
                updateBody = JSON.parse(String(init?.body)) as Record<string, unknown>
                return Response.json({ ...item, ...updateBody })
            }
            return Response.json(page())
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        await user.click(screen.getByTitle('수정'))
        expect(screen.getByRole('dialog', { name: '품목 수정' })).toBeInTheDocument()
        expect(screen.getByLabelText('품번 *')).toHaveAttribute('readonly')
        const price = screen.getByLabelText('단가 *')
        await user.clear(price)
        await user.type(price, '15000')
        await user.click(screen.getByRole('button', { name: '저장' }))

        expect(await screen.findByRole('status')).toHaveTextContent('품목을 수정했습니다.')
        expect(updateBody).not.toHaveProperty('itemNo')
        expect(updateBody).toMatchObject({ price: 15000 })
    })

    it('requires confirmation before deleting and refreshes the server list', async () => {
        const user = userEvent.setup()
        let deleted = false
        const fetchMock = createFetchMock(async (url, init) => {
            const method = init?.method ?? 'GET'
            if (url.pathname.endsWith('/items/7') && method === 'DELETE') {
                deleted = true
                return new Response(null, { status: 204 })
            }
            return Response.json(page())
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        await user.click(screen.getByTitle('삭제'))
        expect(screen.getByRole('alertdialog', { name: '품목 삭제' })).toHaveTextContent('M-S002')
        expect(deleted).toBe(false)
        await user.click(screen.getByRole('button', { name: '삭제 확인' }))

        expect(await screen.findByRole('status')).toHaveTextContent('품목을 삭제했습니다.')
        expect(deleted).toBe(true)
    })

    it('applies the dashboard alert keyword to the initial server query', async () => {
        const fetchMock = createFetchMock(() => Response.json(page()))
        renderItems(fetchMock, '/items?keyword=M-S002')
        await screen.findByText('M-S002')
        expect(screen.getByPlaceholderText('품번, 품명 검색...')).toHaveValue('M-S002')
        expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('keyword') === 'M-S002')).toBe(true)
    })

    it('keeps the form open and shows the trace id when a write fails', async () => {
        const user = userEvent.setup()
        const fetchMock = createFetchMock(async (url, init) => {
            if (url.pathname.endsWith('/items') && init?.method === 'POST') {
                return Response.json({
                    code: 'ITEM_NO_DUPLICATE',
                    message: '이미 존재하는 품번입니다.',
                    traceId: 'item-write-trace',
                }, { status: 409 })
            }
            return Response.json(page())
        })
        renderItems(fetchMock)
        await screen.findByText('M-S002')

        await user.click(screen.getByRole('button', { name: '품목 등록' }))
        const dialog = screen.getByRole('dialog', { name: '품목 등록' })
        await user.type(within(dialog).getByLabelText('품번 *'), 'M-S002')
        await user.type(within(dialog).getByLabelText('품목명 *'), '중복 품목')
        await user.selectOptions(within(dialog).getByLabelText('유형 *'), '자재')
        await user.type(within(dialog).getByLabelText('단위 *'), 'EA')
        await user.type(within(dialog).getByLabelText('단가 *'), '1000')
        await user.click(screen.getByRole('button', { name: '등록' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('이미 존재하는 품번입니다.')
        expect(screen.getByRole('alert')).toHaveTextContent('Trace ID: item-write-trace')
        expect(screen.getByRole('dialog', { name: '품목 등록' })).toBeInTheDocument()
    })
})
