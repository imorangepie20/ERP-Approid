import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchReceivablePage, fetchReceivableSummary, receivableStatuses, type ReceivableRow } from '../../api/receivables'
import { useAuth } from '../../auth/AuthContext'
import { usePartnerSelection } from '../../hooks/usePartnerSelection'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { type StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import { AsyncState } from '../../components/common/AsyncState'
import ReceivableCollectionDialog from './ReceivableCollectionDialog'
import ReceivableReminderDialog from './ReceivableReminderDialog'

const won = (v: number) => `${v.toLocaleString('ko-KR')}원`
const inputClass = 'rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary'
const tones: Record<string, StatusTone> = { 미수: 'warning', 연체: 'danger', 수납완료: 'success' }

export default function SalesReceivables() {
    const { user } = useAuth()
    if (!user?.roles.some(role => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(role))) return <p role="alert">미수금 조회 권한이 없습니다.</p>
    return <ReceivableList />
}

function ReceivableList() {
    const { core } = useAuth(), selection = usePartnerSelection('고객사')
    const [detailId, setDetailId] = useState<number | null>(null)
    const [reminderOpen, setReminderOpen] = useState(false)
    const [filters, setFilters] = useState({ customerId: '', keyword: '', status: '', overdue: '', page: 1, size: 10, sort: 'receivableNo', direction: 'asc' as 'asc' | 'desc' })
    const change = (values: Partial<typeof filters>) => setFilters(previous => ({ ...previous, page: 1, ...values }))
    const list = useQuery({ queryKey: ['receivables', filters], staleTime: 0,
        queryFn: async ({ signal }) => {
            const result = await fetchReceivablePage(core, { ...filters, customerId: filters.customerId ? Number(filters.customerId) : undefined, page: filters.page - 1, sort: `${filters.sort},${filters.direction}` }, signal)
            if (!signal.aborted && filters.page > Math.max(1, result.totalPages)) change({ page: Math.max(1, result.totalPages) })
            return result
        } })
    const summary = useQuery({ queryKey: ['receivables', 'summary'], staleTime: 0, queryFn: ({ signal }) => fetchReceivableSummary(core, signal) })
    const columns: DataTableColumn<ReceivableRow>[] = [
        { key: 'receivableNo', label: '청구번호' },
        { key: 'customerName', label: '고객사', sortable: false },
        { key: 'salesOrderNo', label: '수주번호', sortable: false, render: r => r.salesOrderId === null ? '미연결' : <Link className="text-hud-accent-primary underline" to={`/sales/orders?keyword=${encodeURIComponent(r.salesOrderNo!)}`}>{r.salesOrderNo}</Link> },
        { key: 'amount', label: '문서 원금', render: r => won(r.amount) },
        { key: 'collectedAmount', label: '총 수납액', sortable: false, render: r => won(r.collectedAmount) },
        { key: 'remainingAmount', label: '현재 잔액', sortable: false, render: r => won(r.remainingAmount) },
        { key: 'dueDate', label: '수납기일' },
        { key: 'overdueDays', label: '날짜 연체일', sortable: false, render: r => r.overdue ? <span className="text-hud-accent-danger">{r.overdueDays}일</span> : '-' },
        { key: 'status', label: '저장 상태', render: r => <StatusBadge tone={tones[r.status] ?? 'muted'}>{r.status}</StatusBadge> },
        { key: 'actions', label: '수납·이력', sortable: false, render: r => <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>{r.receivableNo} 수납·이력</Button> },
    ]
    return <div className="space-y-4">
        <p className="text-sm text-hud-text-secondary">실제 원금·수납액·잔액 조회입니다. 수납·이력에서 전액/부분수납을 기록합니다. 독촉은 대상·내용 검토만 가능하며 실제 발송은 준비 중입니다. 저장 상태와 날짜 기준 연체를 구분합니다.</p>
        <section aria-label="전체 미수 요약" className="rounded-lg border border-hud-border-secondary p-4">
            <h2 className="font-semibold">전체 미수 문서 원금 · 필터와 무관한 전체 요약</h2>
            <AsyncState isLoading={summary.isPending} error={summary.error} onRetry={() => { void summary.refetch() }}>
                {summary.data && <><p className="text-sm text-hud-text-muted">날짜 기준 {summary.data.referenceDate} (서울)</p>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div><dt>미수 문서</dt><dd>{summary.data.openCount}건</dd></div>
                        <div><dt>미수 원금</dt><dd>{won(summary.data.openAmount)}</dd></div>
                        <div><dt>날짜 연체 문서</dt><dd>{summary.data.overdueCount}건</dd></div>
                        <div><dt>연체 원금</dt><dd>{won(summary.data.overdueAmount)}</dd></div>
                        <div><dt>실제 미수 잔액</dt><dd>{won(summary.data.openBalance)}</dd></div>
                        <div><dt>실제 연체 잔액</dt><dd>{won(summary.data.overdueBalance)}</dd></div>
                    </dl></>}
            </AsyncState>
        </section>
        <DataTable title="미납 관리" subtitle={`실제 미수 문서 조회 · 연체 기준 ${list.data?.rows[0]?.referenceDate ?? '서울 오늘'}`}
            columns={columns} data={list.data?.rows ?? []} rowKey="id" searchPlaceholder="청구번호, 고객사, 수주번호 검색..." exportAction={null}
            toolbar={<div className="flex gap-2"><Button variant="outline" disabled={list.isFetching || summary.isFetching} onClick={() => { void list.refetch(); void summary.refetch() }}>미수 새로고침</Button><Button variant="primary" onClick={() => setReminderOpen(true)}>독촉 발송 검토</Button></div>}
            filter={<div className="flex flex-wrap gap-2">
                <select aria-label="미수 고객 필터" className={inputClass} value={filters.customerId} disabled={!selection.ready} onChange={e => change({ customerId: e.target.value })}><option value="">전체 고객</option>{selection.partners.map(p => <option key={p.id} value={p.id}>{p.partnerNo} · {p.name}</option>)}</select>
                <select aria-label="미수 상태 필터" className={inputClass} value={filters.status} onChange={e => change({ status: e.target.value })}><option value="">전체 저장 상태</option>{receivableStatuses.map(s => <option key={s}>{s}</option>)}</select>
                <select aria-label="날짜 연체 필터" className={inputClass} value={filters.overdue} onChange={e => change({ overdue: e.target.value })}><option value="">전체 날짜 상태</option><option value="true">날짜 기준 연체</option><option value="false">날짜 기준 비연체</option></select>
            </div>}
            remote={{ searchQuery: filters.keyword, currentPage: filters.page, rowsPerPage: filters.size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0, sortColumn: filters.sort, sortDirection: filters.direction,
                onSearchQueryChange: keyword => change({ keyword }), onPageChange: page => change({ page }), onRowsPerPageChange: size => change({ size }), onSortChange: (sort, direction) => change({ sort, direction }) }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '조건에 맞는 미수 문서가 없습니다.' }} />
        {selection.status}
        {detailId !== null && <ReceivableCollectionDialog receivableId={detailId} onClose={() => setDetailId(null)} />}
        {reminderOpen && <ReceivableReminderDialog onClose={() => setReminderOpen(false)} />}
    </div>
}
