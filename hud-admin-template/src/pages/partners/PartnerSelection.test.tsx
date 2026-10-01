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
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/auth/me')) return Response.json({ id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] })
        if (fail) return Response.json({ code: 'ERROR', message: '거래처 조회 실패', traceId: 'options-trace' }, { status: 503 })
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

    it('carries customer identity and payment terms from a quotation into an order', async () => {
        const user = userEvent.setup()
        setup(<SalesQuotations />)
        await vi.waitFor(() => expect(screen.getByRole('button', { name: '견적 등록' })).toBeEnabled())
        await user.click(screen.getByRole('button', { name: '견적 등록' }))
        const dialog = within(screen.getByRole('dialog'))
        await user.selectOptions(dialog.getByLabelText('고객사 *'), '90')
        const itemOptions = within(dialog.getByLabelText('품목 *')).getAllByRole('option')
        await user.selectOptions(dialog.getByLabelText('품목 *'), (itemOptions[1] as HTMLOptionElement).value)
        await user.type(dialog.getByLabelText('수량 *'), '2')
        fireEvent.change(dialog.getByLabelText('납기 *'), { target: { value: '2026-10-20' } })
        fireEvent.change(dialog.getByLabelText('유효기간 *'), { target: { value: '2026-10-15' } })
        await user.click(dialog.getByRole('button', { name: '등록' }))
        let saved = JSON.parse(screen.getByLabelText('저장 데이터').textContent!)
        expect(saved.quote).toMatchObject({ customerId: 90, customer: partner.name, paymentTerms: 60, leadTimeDays: 9 })
        await user.click(screen.getByRole('button', { name: '테스트 견적 전환' }))
        saved = JSON.parse(screen.getByLabelText('저장 데이터').textContent!)
        expect(saved.order).toMatchObject({ customerId: 90, paymentTerms: 60, leadTimeDays: 9 })
    })

    it('also connects the customer selector in direct sales orders', async () => {
        const user = userEvent.setup()
        setup(<SalesOrders />)
        await vi.waitFor(() => expect(screen.getByRole('button', { name: '수주 등록' })).toBeEnabled())
        await user.click(screen.getByRole('button', { name: '수주 등록' }))
        await user.selectOptions(screen.getByLabelText('고객사 *'), '90')
        expect(screen.getByLabelText('결제조건(일)')).toHaveValue(60)
        expect(screen.getByRole('option', { name: /T-LIVE-001/ })).toHaveValue('90')
    })

    it('shows lookup errors and blocks creation without a memory fallback', async () => {
        setup(<PurchaseOrders />, true)
        expect(await screen.findByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
        expect(screen.getByText(/options-trace/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '발주 등록' })).toBeDisabled()
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    })
})
