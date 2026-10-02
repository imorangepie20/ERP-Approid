import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthContext'
import { saveSession } from '../../auth/session'
import { DataProvider, useData } from '../../store/DataContext'
import { dateAfterDays } from '../../hooks/usePartnerSelection'
import PurchaseOrders from '../purchase/PurchaseOrders'
import SalesQuotations from '../sales/SalesQuotations'
import SalesOrders from '../sales/SalesOrders'

const env = { VITE_API_CORE_URL: 'https://core.example.test/api/core', VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics' }
const partner = { id: 90, partnerNo: 'T-LIVE-001', name: '실제 선택 거래처', partnerType: '고객사', contact: '', contactName: '', paymentTerms: 60, leadTimeDays: 9 }

function Observer() {
    const data = useData()
    const quote = data.quotations[data.quotations.length - 1]
    return <><output aria-label="저장 데이터">{JSON.stringify({ quote, order: data.salesOrders[data.salesOrders.length - 1], purchase: data.purchaseOrders[data.purchaseOrders.length - 1] })}</output>
        <button onClick={() => { if (quote) data.quotationToOrder(quote.id) }}>테스트 견적 전환</button></>
}

function setup(component: React.ReactNode, fail = false) {
    saveSession(sessionStorage, 'token', 3600)
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/auth/me')) return Response.json({ id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] })
        if (fail) return Response.json({ code: 'ERROR', message: '거래처 조회 실패', traceId: 'options-trace' }, { status: 503 })
        if (url.pathname.endsWith('/items')) return Response.json({ content: [{ id: 2, itemNo: 'P-LIVE', name: '실제 제품', itemType: '제품', unit: 'EA', price: 100, stock: 0, safetyStock: 0, leadTimeDays: 0 }], number: 0, size: 100, totalElements: 1, totalPages: 1 })
        if (url.pathname.endsWith('/quotations') || url.pathname.endsWith('/sales-orders')) {
            if (init?.method === 'POST') return Response.json({ ...JSON.parse(String(init.body)), id: 77,
                customerName: partner.name, itemNo: 'P-LIVE', itemName: '실제 제품', paymentTerms: 60, leadTimeDays: 9,
                status: '작성중', amount: 200 }, { status: 201 })
            return Response.json({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 })
        }
        const content = [{ ...partner, partnerType: url.searchParams.get('partnerType') }]
        return Response.json({ content, number: 0, size: 100, totalElements: 1, totalPages: 1 })
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider env={env} fetch={fetch}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DataProvider>{component}<Observer /></DataProvider></MemoryRouter></AuthProvider>
    </QueryClientProvider>)
    return fetch
}

describe('real partner selection in business forms', () => {
    beforeEach(() => sessionStorage.clear())

    it('selects a supplier by ID and suggests receipt date from its lead time', async () => {
        const user = userEvent.setup()
        setup(<PurchaseOrders />)
        await screen.findByRole('button', { name: '발주 등록' })
        // Wait for the actual options to load before opening the form.
        await screen.findByText('발주 관리')
        await vi.waitFor(() => expect(screen.getByRole('button', { name: '발주 등록' })).toBeEnabled())
        await user.click(screen.getByRole('button', { name: '발주 등록' }))
        const dialog = within(screen.getByRole('dialog'))
        await user.selectOptions(dialog.getByLabelText('발주처 *'), '90')
        expect(dialog.getByLabelText('결제조건(일)')).toHaveValue(60)
        expect(dialog.getByLabelText('리드타임(일)')).toHaveValue(9)
        expect(dialog.getByLabelText('입고예정일 *')).toHaveValue(dateAfterDays(9))
        expect(dialog.getByRole('button', { name: '입고예정일 달력 열기' })).toBeEnabled()
    })

    it('posts actual customer and item IDs when creating a quotation', async () => {
        const user = userEvent.setup()
        const fetch = setup(<SalesQuotations />)
        await vi.waitFor(() => expect(screen.getByRole('button', { name: '견적 등록' })).toBeEnabled())
        await user.click(screen.getByRole('button', { name: '견적 등록' }))
        const dialog = within(screen.getByRole('dialog'))
        await user.type(dialog.getByLabelText('견적번호 *'), 'QT-LIVE')
        await user.selectOptions(dialog.getByLabelText('고객사 *'), '90')
        const itemOptions = within(dialog.getByLabelText('품목 *')).getAllByRole('option')
        await user.selectOptions(dialog.getByLabelText('품목 *'), (itemOptions[1] as HTMLOptionElement).value)
        await user.clear(dialog.getByLabelText('수량 *'))
        await user.type(dialog.getByLabelText('수량 *'), '2')
        expect(dialog.getByLabelText('결제조건(일)')).toHaveValue(60)
        expect(dialog.getByLabelText('리드타임(일)')).toHaveValue(9)
        fireEvent.change(dialog.getByLabelText('납기 *'), { target: { value: '2026-10-20' } })
        fireEvent.change(dialog.getByLabelText('유효기간 *'), { target: { value: '2026-10-15' } })
        await user.click(dialog.getByRole('button', { name: '등록' }))
        await screen.findByText('견적을 등록했습니다.')
        const call = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
        expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ customerId: 90, itemId: 2, qty: 2, quotationNo: 'QT-LIVE' })
    })

    it('also connects the customer selector in direct sales orders', async () => {
        const user = userEvent.setup()
        setup(<SalesOrders />)
        await vi.waitFor(() => expect(screen.getByRole('button', { name: '수주 등록' })).toBeEnabled())
        await user.click(screen.getByRole('button', { name: '수주 등록' }))
        await user.selectOptions(screen.getByLabelText('고객사 *'), '90')
        expect(screen.getByLabelText('결제조건(일)')).toHaveValue(60)
        expect(within(screen.getByRole('dialog')).getByRole('option', { name: /T-LIVE-001/ })).toHaveValue('90')
    })

    it('shows lookup errors and blocks creation without a memory fallback', async () => {
        setup(<PurchaseOrders />, true)
        expect(await screen.findByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
        expect(screen.getByText(/options-trace/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '발주 등록' })).toBeDisabled()
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    })
})
