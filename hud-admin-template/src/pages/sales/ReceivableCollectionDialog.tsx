import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collectReceivable, fetchReceivableDetail, validCollectionInput, type CollectionInput, type ReceivableRow } from '../../api/receivables'
import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'
import DateInput from '../../components/common/DateInput'

const won = (v: number) => `${v.toLocaleString('ko-KR')}원`
const inputClass = 'w-full rounded border border-hud-border-secondary bg-hud-bg-primary px-3 py-2'
interface Props { receivableId: number; onClose: () => void }

export default function ReceivableCollectionDialog({ receivableId, onClose }: Props) {
    const { core, user } = useAuth(), [page, setPage] = useState(0)
    const allowed = !!user?.roles.some(r => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(r))
    const canCollect = !!user?.roles.some(r => ['ADMIN', 'ACCOUNTING'].includes(r))
    const detail = useQuery({ queryKey: ['receivables', 'detail', receivableId, page], enabled: allowed, staleTime: 0,
        queryFn: ({ signal }) => fetchReceivableDetail(core, receivableId, page, signal) })
    if (!allowed) return <p role="alert">미수금 조회 권한이 없습니다.</p>
    return <Dialog open onClose={onClose} className="relative z-[100]">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-hud-border-secondary bg-hud-bg-secondary p-6">
            <DialogTitle className="text-lg font-semibold">미수금 수납·이력</DialogTitle>
            <AsyncState isLoading={detail.isPending} error={detail.error} onRetry={() => { void detail.refetch() }}>
                {detail.data && <div className="space-y-4 mt-4">
                    <p>{detail.data.receivable.receivableNo} · {detail.data.receivable.customerName}</p>
                    <p>문서 원금 {won(detail.data.receivable.amount)} · 총 수납액 {won(detail.data.receivable.collectedAmount)} · 현재 잔액 {won(detail.data.receivable.remainingAmount)}</p>
                    {detail.data.receivable.openingCollectedAmount > 0 && <p className="text-hud-accent-warning">이월 수납액 {won(detail.data.receivable.openingCollectedAmount)}: 기존 수납완료 상태에 따른 이월이며 과거 수납일과 처리자는 확인할 수 없습니다.</p>}
                    {canCollect && <CollectionForm key={receivableId} receivable={detail.data.receivable} onClose={onClose} />}
                    <p className="text-sm text-hud-text-muted">수납 이력은 변경·삭제하지 않습니다. 실제 회계 전표와 수납 취소·환불은 후속 기능입니다.</p>
                    {detail.data.collections.rows.length === 0 ? <p>새 수납 이력이 없습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left">저장된 수납 이력 · 최신 처리 순</caption>
                        <thead><tr>{['수납일', '수납 금액', '처리 후 잔액', '처리자 / 기록 시각', '추적 ID'].map(label => <th key={label} scope="col" className="p-2 text-left">{label}</th>)}</tr></thead>
                        <tbody>{detail.data.collections.rows.map(c => <tr key={c.id} className="border-t border-hud-border-secondary"><td className="p-2">{c.collectedOn}</td><td className="p-2">{won(c.amount)}</td><td className="p-2">{won(c.remainingAmount)}</td><td className="p-2"><span>사용자 #{c.actorId}</span><br />{new Date(c.recordedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울)</td><td className="p-2 font-mono">{c.traceId}</td></tr>)}</tbody>
                    </table></div>}
                    <div className="flex gap-3 items-center"><Button variant="outline" disabled={page === 0 || detail.isFetching} onClick={() => setPage(page - 1)}>이전 수납 이력</Button><span>{page + 1} / {Math.max(1, detail.data.collections.totalPages)} · {detail.data.collections.totalElements}건</span><Button variant="outline" disabled={page + 1 >= detail.data.collections.totalPages || detail.isFetching} onClick={() => setPage(page + 1)}>다음 수납 이력</Button></div>
                </div>}
            </AsyncState>
            <div className="text-right mt-4"><Button variant="ghost" onClick={onClose}>닫기</Button></div>
        </DialogPanel></div>
    </Dialog>
}

function CollectionForm({ receivable, onClose }: { receivable: ReceivableRow; onClose: () => void }) {
    const { core, user } = useAuth(), queryClient = useQueryClient()
    const storageKey = `erp.collection.pending:${user!.id}:${receivable.id}`
    const [initial] = useState(() => {
        try {
            const raw = sessionStorage.getItem(storageKey)
            if (!raw) return { attempt: null, error: null }
            const parsed: unknown = JSON.parse(raw)
            return validCollectionInput(parsed) ? { attempt: parsed, error: null } : { attempt: null, error: '저장된 미확인 수납 요청이 손상되었습니다. 처리 이력을 확인한 뒤 관리자에게 문의하세요.' }
        } catch { return { attempt: null, error: '미확인 수납 요청 저장소에 접근할 수 없습니다. 브라우저 저장소 설정을 확인하세요.' } }
    })
    const [attempt, setAttempt] = useState<CollectionInput | null>(initial.attempt)
    const [amount, setAmount] = useState(initial.attempt ? String(initial.attempt.amount) : '')
    const [date, setDate] = useState(initial.attempt?.collectedOn ?? receivable.referenceDate)
    const [storageError, setStorageError] = useState(initial.error)
    const mutation = useMutation({ retry: false, mutationFn: (input: CollectionInput) => collectReceivable(core, receivable.id, input),
        onSuccess: () => {
            try { sessionStorage.removeItem(storageKey) } catch { setStorageError('수납은 저장됐지만 재시도 기록을 지우지 못했습니다. 같은 키의 재전송은 중복 저장하지 않습니다.') }
            for (const queryKey of [['receivables'], ['sales-analysis'], ['dashboard']]) void queryClient.invalidateQueries({ queryKey })
            onClose()
        } })
    const valid = /^\d+$/.test(amount) && Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= receivable.remainingAmount
        && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= receivable.referenceDate
    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        if (mutation.isPending || storageError || (!attempt && !valid)) return
        const input = attempt ?? { amount: Number(amount), collectedOn: date, requestId: crypto.randomUUID() }
        try { sessionStorage.setItem(storageKey, JSON.stringify(input)) } catch { setStorageError('요청 키를 안전하게 저장하지 못해 수납을 전송하지 않았습니다. 브라우저 저장소 설정을 확인하세요.'); return }
        setAttempt(input); mutation.mutate(input)
    }
    const definitiveFailure = mutation.error instanceof ApiError && [400, 403, 404, 422].includes(mutation.error.status) && mutation.error.code !== 'INVALID_RESPONSE'
    const reset = () => {
        try { sessionStorage.removeItem(storageKey); setAttempt(null); mutation.reset(); void queryClient.invalidateQueries({ queryKey: ['receivables'] }) }
        catch { setStorageError('재시도 기록을 지우지 못했습니다. 브라우저 저장소 설정을 확인하세요.') }
    }
    if (receivable.remainingAmount === 0 && !attempt) return <p>수납할 잔액이 없습니다.</p>
    return <form onSubmit={submit} className="space-y-3 rounded border border-hud-border-secondary p-4">
        <p>수납 확정 시 금액·수납일·처리자와 잔액을 저장합니다. 통신 오류는 같은 요청으로 재시도하세요.</p>
        {storageError && <p role="alert">{storageError}</p>}
        {attempt && <p role="status">처리 결과 미확인 또는 재시도 대기: 같은 요청 키와 입력을 유지합니다. 창을 닫아도 이 브라우저 세션에서 재시도할 수 있습니다.</p>}
        <label className="block">수납 금액<input aria-label="수납 금액" className={inputClass} type="number" min="1" max={receivable.remainingAmount} step="1" value={amount} disabled={!!attempt || mutation.isPending || !!storageError} onChange={e => setAmount(e.target.value)} required /></label>
        <Button type="button" variant="outline" disabled={!!attempt || mutation.isPending || !!storageError} onClick={() => setAmount(String(receivable.remainingAmount))}>잔액 전액 입력</Button>
        <label className="block">수납일<DateInput aria-label="수납일" className={inputClass} value={date} max={receivable.referenceDate} disabled={!!attempt || mutation.isPending || !!storageError} onChange={e => setDate(e.target.value)} required /></label>
        <AsyncState error={mutation.error} />
        {definitiveFailure && <Button type="button" variant="outline" onClick={reset}>실패 확인 후 입력 다시 작성</Button>}
        <Button type="submit" variant="primary" disabled={mutation.isPending || !!storageError || (!attempt && !valid)}>{mutation.isPending ? '수납 저장 중...' : attempt ? '같은 요청 재시도' : '수납 저장'}</Button>
    </form>
}
