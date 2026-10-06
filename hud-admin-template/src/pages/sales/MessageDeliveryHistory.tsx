import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReminderHistory, retryMessage, type MessageSummaryRow } from '../../api/messages'
import { useAuth } from '../../auth/AuthContext'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'

const retryableErrors = ['SMTP_TRANSIENT_FAILURE', 'CONNECTION_FAILED']
export function messageStateLabel(row: Pick<MessageSummaryRow, 'state' | 'errorCode' | 'attemptCount'>): string {
    switch (row.state) {
        case 'SMTP_ACCEPTED': return '메일 서버 접수'
        case 'QUEUED': return '발송 요청 접수'
        case 'CLAIMED': case 'DISPATCHING': return '발송 처리 중'
        case 'RETRY_WAIT': return '재시도 대기 중'
        case 'UNKNOWN': return '접수 여부 확인 필요 · 재발송 금지'
        case 'STALE': return '만료됨 · 새로 검토 필요'
        case 'FAILED': return row.errorCode && retryableErrors.includes(row.errorCode) && row.attemptCount < 3 ? '발송 실패 · 재시도 가능' : '발송 실패'
        default: return row.state
    }
}
export function canRetry(row: Pick<MessageSummaryRow, 'state' | 'errorCode' | 'attemptCount'>, canWrite: boolean): boolean {
    return canWrite && row.state === 'FAILED' && !!row.errorCode && retryableErrors.includes(row.errorCode) && row.attemptCount < 3
}
export default function MessageDeliveryHistory({ receivableId }: { receivableId: number }) {
    const { user, core } = useAuth()
    const canWrite = !!user?.roles.some(r => ['ADMIN', 'ACCOUNTING'].includes(r))
    const queryClient = useQueryClient()
    const history = useQuery({ queryKey: ['messages', 'history', receivableId], staleTime: 0,
        refetchOnWindowFocus: false, queryFn: ({ signal }) => fetchReminderHistory(core, receivableId, 0, signal) })
    const retry = useMutation({
        mutationFn: (id: string) => retryMessage(core, id, crypto.randomUUID()),
        onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['messages', 'history', receivableId] }) },
    })
    return <section aria-label="발송 요청 이력" className="space-y-3 rounded border border-hud-border-secondary p-4">
        <h3 className="font-semibold">발송 요청 이력</h3>
        <AsyncState isLoading={history.isPending} error={history.error} isEmpty={history.data?.rows.length === 0} emptyMessage="발송 요청 이력이 없습니다." onRetry={() => { void history.refetch() }}>
            {history.data && <ul className="space-y-2">{history.data.rows.map(row => <li key={row.id} className="rounded border border-hud-border-secondary p-2">
                <p>{messageStateLabel(row)} · {row.recipient} · 시도 {row.attemptCount}회</p>
                {canRetry(row, canWrite) && <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(row.id)}>재시도 요청</Button>}
                {retry.isError && <p role="alert">재시도에 실패했습니다. 최신 이력을 다시 확인하세요.</p>}
            </li>)}</ul>}
        </AsyncState>
    </section>
}
