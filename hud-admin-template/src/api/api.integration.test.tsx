import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AsyncState } from '../components/common/AsyncState'
import { createHttpClient } from './http'
import { createAppQueryClient } from './query-client'

function ItemName({ client }: { client: ReturnType<typeof createHttpClient> }) {
    const query = useQuery({
        queryKey: ['integration-item'],
        queryFn: async () => (await client.get<{ name: string }>('items/1')).data,
    })

    return (
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()}>
            <p>{query.data?.name}</p>
        </AsyncState>
    )
}

describe('API foundation integration', () => {
    it('loads API data through the shared HTTP and React Query layers', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
            JSON.stringify({ name: '완제품 A' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        ))
        const httpClient = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            fetch: fetchMock,
        })

        render(
            <QueryClientProvider client={createAppQueryClient()}>
                <ItemName client={httpClient} />
            </QueryClientProvider>,
        )

        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
        expect(await screen.findByText('완제품 A')).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
