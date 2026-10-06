import { useReducer, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useQuery } from '@tanstack/react-query'
import { fetchReceivablePage, fetchReminderPreview, validReminderRecipient, type ReminderChannel, type ReminderPreview } from '../../api/receivables'
import { useAuth } from '../../auth/AuthContext'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'

const won = (v: number) => `${v.toLocaleString('ko-KR')}원`
const inputClass = 'w-full rounded border border-hud-border-secondary bg-hud-bg-primary p-2'
export default function ReceivableReminderDialog({ onClose }: { onClose: () => void }) {
    const { user } = useAuth()
    if (!user?.roles.some(r => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(r))) return <p role="alert">미수금 조회 권한이 없습니다.</p>
    return <ReminderReview onClose={onClose} />
}

function ReminderReview({ onClose }: { onClose: () => void }) {
    const { core } = useAuth()
    const [filters, setFilters] = useState({ keyword: '', page: 0 })
    const [selected, setSelected] = useState<number | null>(null)
    const [notice, setNotice] = useState('')
    const targets = useQuery({ queryKey: ['receivables', 'reminder-targets', filters], staleTime: 0,
        queryFn: ({ signal }) => fetchReceivablePage(core, { ...filters, size: 10, sort: 'dueDate,asc', overdue: 'true', status: '' }, signal) })
    const preview = useQuery({ queryKey: ['receivables', 'reminder-preview', selected], enabled: selected !== null, staleTime: 0,
        refetchOnWindowFocus: false, queryFn: ({ signal }) => fetchReminderPreview(core, selected!, signal) })
    const change = (values: Partial<typeof filters>) => { setSelected(null); setNotice(''); setFilters(previous => ({ ...previous, ...values })) }
    const verify = async () => {
        const previous = preview.data
        const refreshed = await preview.refetch()
        if (refreshed.isError || !refreshed.data) return false
        if (JSON.stringify(previous) !== JSON.stringify(refreshed.data)) {
            setNotice('미수금 또는 거래처 정보가 변경되었습니다. 갱신된 정보로 내용을 다시 확인하세요.')
            return false
        }
        setNotice(''); return true
    }
    return <Dialog open onClose={onClose} className="relative z-[100]">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-hud-border-secondary bg-hud-bg-secondary p-6 space-y-4">
            <DialogTitle className="text-lg font-semibold">독촉 발송 검토</DialogTitle>
            <p>한 번에 한 문서를 검토합니다. 실제 발송 연동 전이며 확인해도 발송 요청·저장·이력은 생성하지 않습니다.</p>
            <label className="block">독촉 대상 검색<input aria-label="독촉 대상 검색" className={inputClass} value={filters.keyword} maxLength={128} disabled={preview.isFetching} onChange={e => change({ keyword: e.target.value, page: 0 })} /></label>
            <AsyncState isLoading={targets.isPending} error={targets.error} isEmpty={targets.data?.rows.length === 0} emptyMessage="날짜 연체 미수 대상이 없습니다." onRetry={() => { void targets.refetch() }}>
                {targets.data && <fieldset className="space-y-2"><legend>실제 날짜 연체 미수 대상 선택</legend>{targets.data.rows.map(r => <label key={r.id} className="block p-2 border border-hud-border-secondary rounded">
                    <input type="radio" name="reminder-target" value={r.id} checked={selected === r.id} disabled={preview.isFetching || !r.overdue || r.remainingAmount <= 0}
                        onChange={() => { setSelected(r.id); setNotice('') }} /> {r.receivableNo} · {r.customerName} · 잔액 {won(r.remainingAmount)} · 기일 {r.dueDate}
                </label>)}</fieldset>}
            </AsyncState>
            <div className="flex gap-3 items-center"><Button variant="outline" disabled={filters.page === 0 || targets.isFetching || preview.isFetching} onClick={() => change({ page: filters.page - 1 })}>이전 독촉 대상</Button><span>{filters.page + 1} / {Math.max(1, targets.data?.totalPages ?? 0)} · {targets.data?.totalElements ?? 0}건</span><Button variant="outline" disabled={!targets.data || filters.page + 1 >= targets.data.totalPages || targets.isFetching || preview.isFetching} onClick={() => change({ page: filters.page + 1 })}>다음 독촉 대상</Button></div>
            {notice && <p role="alert">{notice}</p>}
            {selected !== null && <AsyncState isLoading={preview.isPending} error={preview.error} onRetry={() => { void preview.refetch() }}>
                {preview.data && (preview.data.receivable.overdue && preview.data.receivable.remainingAmount > 0
                    ? <ReminderForm key={JSON.stringify(preview.data)} preview={preview.data} busy={preview.isFetching} verify={verify} />
                    : <p role="alert">현재 날짜 연체 미수 대상이 아닙니다. 대상과 잔액을 다시 확인하세요.</p>)}
            </AsyncState>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>취소 / 닫기</Button><Button variant="primary" disabled title="TODO-004/047 실제 발송 기반이 구현되지 않았습니다.">발송 (준비 중)</Button></div>
        </DialogPanel></div>
    </Dialog>
}

type Draft = { channel: ReminderChannel; recipient: string; note: string; acknowledged: boolean; confirmed: boolean; checking: boolean }
type Action = { type: 'channel'; value: ReminderChannel } | { type: 'recipient' | 'note'; value: string } | { type: 'ack'; value: boolean } | { type: 'checking' | 'confirmed' | 'back' | 'failed' }
function reducer(state: Draft, action: Action): Draft {
    if (action.type === 'channel' || action.type === 'recipient' || action.type === 'note') return { ...state, [action.type]: action.value, acknowledged: false, confirmed: false }
    if (action.type === 'ack') return { ...state, acknowledged: action.value }
    if (action.type === 'checking') return { ...state, checking: true }
    if (action.type === 'confirmed') return { ...state, checking: false, confirmed: true }
    if (action.type === 'back') return { ...state, acknowledged: false, confirmed: false, checking: false }
    return { ...state, checking: false }
}
function ReminderForm({ preview, busy, verify }: { preview: ReminderPreview; busy: boolean; verify: () => Promise<boolean> }) {
    const [draft, dispatch] = useReducer(reducer, { channel: 'EMAIL', recipient: preview.contact ?? '', note: '', acknowledged: false, confirmed: false, checking: false })
    const r = preview.receivable
    const valid = validReminderRecipient(draft.channel, draft.recipient) && draft.note.trim().length <= 1000
    const subject = `미수금 확인 요청 — ${r.receivableNo}`
    const content = `${r.customerName} 담당자님,\n청구번호: ${r.receivableNo}\n수납기일: ${r.dueDate}\n현재 미수 잔액: ${won(r.remainingAmount)}\n조회 기준일: ${r.referenceDate} (서울)\n이미 입금하셨다면 담당자에게 확인을 부탁드립니다.${draft.note.trim() ? `\n\n${draft.note.trim()}` : ''}`
    const confirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!valid || !draft.acknowledged || draft.checking || busy) return
        dispatch({ type: 'checking' })
        const unchanged = await verify()
        dispatch({ type: unchanged ? 'confirmed' : 'failed' })
    }
    return <section aria-label="독촉 내용 검토" className="space-y-3 rounded border border-hud-border-secondary p-4">
        <p>문서 원금 {won(r.amount)} · 총 수납액 {won(r.collectedAmount)} · 현재 잔액 {won(r.remainingAmount)}</p>
        <p>현재 거래처 담당자: {preview.contactName || '미등록'} · 연락처: {preview.contact || '미등록'}</p>
        <p className="text-sm text-hud-text-muted">연락처는 채널·수신동의·수신권한이 검증된 주소가 아닙니다. 이메일/SMS는 검토용 선택이며 실제 공급사·발송 정책은 미정입니다. 수신자의 적합성을 별도로 확인하세요.</p>
        {draft.confirmed ? <div className="space-y-3">
            <p role="status">검토 완료 · 미발송</p><p>화면 내 확인만 완료했습니다. 발송 요청·저장·이력은 생성하지 않았습니다.</p>
            <p aria-label="확인한 수신자">{draft.channel === 'EMAIL' ? '이메일' : 'SMS/LMS'} · {draft.recipient.trim()}</p>
            <Button variant="outline" onClick={() => dispatch({ type: 'back' })}>입력 다시 수정</Button>
        </div> : <form onSubmit={e => { void confirm(e) }} className="space-y-3">
            <label className="block">검토용 채널<select aria-label="검토용 채널" className={inputClass} value={draft.channel} disabled={busy || draft.checking} onChange={e => dispatch({ type: 'channel', value: e.target.value as ReminderChannel })}><option value="EMAIL">이메일 (검토용)</option><option value="SMS">SMS/LMS (검토용)</option></select></label>
            <label className="block">수신 주소 또는 번호<input aria-label="수신 주소 또는 번호" className={inputClass} value={draft.recipient} maxLength={254} disabled={busy || draft.checking} onChange={e => dispatch({ type: 'recipient', value: e.target.value })} required /></label>
            {!validReminderRecipient(draft.channel, draft.recipient) && <p role="alert">수신 주소 형식을 확인하세요. 이메일 또는 국내 휴대전화 번호를 입력해야 합니다.</p>}
            <label className="block">추가 안내 (최대 1,000자)<textarea aria-label="추가 안내" className={inputClass} value={draft.note} maxLength={1000} disabled={busy || draft.checking} onChange={e => dispatch({ type: 'note', value: e.target.value })} /></label>
            <label className="block"><input type="checkbox" checked={draft.acknowledged} disabled={busy || draft.checking} onChange={e => dispatch({ type: 'ack', value: e.target.checked })} /> 수신 대상과 내용을 확인했습니다.</label>
            <Button type="submit" variant="primary" disabled={!valid || !draft.acknowledged || busy || draft.checking}>{draft.checking ? '최신 정보 확인 중...' : '미리보기 확인'}</Button>
        </form>}
        <p aria-label="독촉 제목 미리보기">{subject}</p><pre aria-label="독촉 내용 미리보기" className="whitespace-pre-wrap break-words font-sans rounded bg-hud-bg-primary p-3">{content}</pre>
    </section>
}
