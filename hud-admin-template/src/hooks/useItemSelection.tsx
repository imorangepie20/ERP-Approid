import { useQuery } from '@tanstack/react-query'
import { fetchItemPage, type ItemRow } from '../api/items'
import type { HttpClient } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { AsyncState } from '../components/common/AsyncState'

export async function fetchItemOptions(client: HttpClient, signal?: AbortSignal): Promise<ItemRow[]> {
    const items: ItemRow[] = []
    for (let page = 0; ; page++) {
        const result = await fetchItemPage(client, { page, size: 100, sortColumn: 'itemNo', sortDirection: 'asc' }, signal)
        items.push(...result.items)
        if (page + 1 >= result.totalPages) return items
    }
}
export function useItemSelection() {
    const { core } = useAuth()
    const query = useQuery({ queryKey: ['items', 'options'], queryFn: ({ signal }) => fetchItemOptions(core, signal) })
    const items = query.data ?? []
    return { items, ready: query.isSuccess && items.length > 0,
        options: items.map(item => ({ label: `${item.itemNo} · ${item.name} (${item.unit})`, value: item.id })),
        status: <AsyncState isLoading={query.isPending} error={query.error}
            isEmpty={query.isSuccess && items.length === 0} emptyMessage="선택할 품목이 없습니다. 품목 마스터에서 등록하세요."
            onRetry={() => { void query.refetch() }} /> }
}
