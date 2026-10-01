import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../../auth/AuthContext'
import { saveSession } from '../../auth/session'
import { DataProvider } from '../../store/DataContext'
import type { Role } from '../../auth/types'
import ItemBom from './ItemBom'
import Items from './Items'

const env = {
    VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
}

function renderPage(page: React.ReactNode, roles: Role[]) {
    saveSession(sessionStorage, 'token', 3600)
    const fetchMock = vi.fn<typeof fetch>(async input => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/auth/me')) {
            return Response.json({
                id: 1,
                username: 'user',
                name: '테스트 사용자',
                roles,
            })
        }
        if (url.pathname.endsWith('/items')) {
            return Response.json({
                content: [{
                    id: 1,
                    itemNo: 'P-A001',
                    name: '프레임 가조립품 A',
                    spec: '1000×500×200',
                    category: '조립',
                    itemType: '제품',
                    unit: 'EA',
                    price: 153000,
                    stock: 320,
                    safetyStock: 100,
                    leadTimeDays: 0,
                }],
                number: 0,
                size: 10,
                totalElements: 1,
                totalPages: 1,
            })
        }
        throw new Error(`예상하지 못한 요청: ${url}`)
    })
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <AuthProvider env={env} storage={sessionStorage} fetch={fetchMock}>
                <DataProvider>
                    <MemoryRouter>{page}</MemoryRouter>
                </DataProvider>
            </AuthProvider>
        </QueryClientProvider>,
    )
}

describe('item permissions', () => {
    beforeEach(() => sessionStorage.clear())

    it('shows item create/edit/delete actions only to ADMIN', async () => {
        const admin = renderPage(<Items />, ['ADMIN'])
        await screen.findByRole('heading', { name: '품목 마스터' })
        expect(await screen.findByText('P-A001')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '품목 등록' })).toBeEnabled()
        expect(screen.getAllByTitle('수정').length).toBeGreaterThan(0)
        expect(screen.getAllByTitle('삭제').length).toBeGreaterThan(0)
        admin.unmount()
        sessionStorage.clear()

        renderPage(<Items />, ['SALES'])
        await screen.findByRole('heading', { name: '품목 마스터' })
        expect(await screen.findByText('P-A001')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '품목 등록' })).not.toBeInTheDocument()
        expect(screen.queryByTitle(/수정/)).not.toBeInTheDocument()
        expect(screen.queryByTitle(/삭제/)).not.toBeInTheDocument()
    })

    it('allows PRODUCTION to create/edit BOM but reserves deletion for ADMIN', async () => {
        renderPage(<ItemBom />, ['PRODUCTION'])
        await screen.findByRole('heading', { name: 'BOM 관리' })
        expect(screen.getByRole('button', { name: 'BOM 등록' })).toBeInTheDocument()
        expect(screen.getAllByTitle('수정').length).toBeGreaterThan(0)
        expect(screen.queryByTitle('삭제')).not.toBeInTheDocument()
    })

    it('allows ADMIN to create, edit and delete BOM', async () => {
        renderPage(<ItemBom />, ['ADMIN'])
        await screen.findByRole('heading', { name: 'BOM 관리' })
        expect(screen.getByRole('button', { name: 'BOM 등록' })).toBeInTheDocument()
        expect(screen.getAllByTitle('수정').length).toBeGreaterThan(0)
        expect(screen.getAllByTitle('삭제').length).toBeGreaterThan(0)
    })
})
