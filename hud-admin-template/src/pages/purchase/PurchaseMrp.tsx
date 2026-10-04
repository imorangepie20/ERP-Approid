import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchMrp, createMrpPurchase, addDateDays, type MrpRow, type MrpPurchase } from '../../api/mrp'
import { seoulToday } from '../../api/dashboard'
import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { usePartnerSelection } from '../../hooks/usePartnerSelection'
import { AsyncState } from '../../components/common/AsyncState'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'
import DateInput from '../../components/common/DateInput'
import FormModal, { type ModalField } from '../../components/common/FormModal'

const actions: Record<string, string> = { PURCHASE: '발주 필요', PRODUCE: '생산 보충 필요', MISSING_BOM: 'BOM 확인 필요', EXPEDITE: '공급 납기 조정 필요', COVERED: '수량 충당' }
const amount = (qty: number, unit: string) => `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${unit}`
export default function PurchaseMrp() {
    const { core, user } = useAuth()
    const cache = useQueryClient(), items = useItemSelection(), vendors = usePartnerSelection('발주처')
    const canWrite = user?.roles.some(role => role === 'MATERIAL' || role === 'ADMIN') ?? false
    const [through, setThrough] = useState(() => addDateDays(seoulToday(), 90))
    const [appliedThrough, setAppliedThrough] = useState(through)
    const [params] = useSearchParams()
    const [itemId, setItemId] = useState(() => {
        const value = params.get('itemId') ?? ''
        return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? value : ''
    }), [page, setPage] = useState(0)
    const [target, setTarget] = useState<MrpRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [created, setCreated] = useState<MrpPurchase | null>(null)
    const query = useQuery({ queryKey: ['mrp', { through: appliedThrough, itemId, page }],
        queryFn: ({ signal }) => fetchMrp(core, { through: appliedThrough, itemId: itemId ? Number(itemId) : undefined, page, size: 50 }, signal), staleTime: 0 })
    const create = useMutation({ mutationFn: () => createMrpPurchase(core, { purchaseOrderNo: values.purchaseOrderNo,
        vendorId: Number(values.vendorId), itemId: target!.itemId, qty: target!.suggestedPurchaseQty,
        unitPrice: Number(values.unitPrice), dueDate: values.dueDate }),
        onSuccess: async po => {
            setCreated(po); setTarget(null); setPage(0)
            await Promise.all(['mrp', 'purchase-orders', 'dashboard'].map(key => cache.invalidateQueries({ queryKey: [key] })))
        } })
    const open = (row: MrpRow) => {
        create.reset(); setCreated(null); setTarget(row)
        const earliest = addDateDays(seoulToday(), row.leadTimeDays)
        setValues({ purchaseOrderNo: `PO-MRP-${crypto.randomUUID().slice(0, 18).toUpperCase()}`, vendorId: '',
            qty: String(row.suggestedPurchaseQty), unitPrice: String(row.price || ''), dueDate: row.requiredBy > earliest ? row.requiredBy : earliest })
    }
    const fields: ModalField[] = [
        { key: 'purchaseOrderNo', label: '발주번호', type: 'text', required: true, maxLength: 32 },
        vendors.field('vendorId', '발주처'),
        { key: 'qty', label: `제안 수량 (${target?.unit ?? ''})`, type: 'number', required: true, readOnly: true, step: 0.0001 },
        { key: 'unitPrice', label: '확인 단가(원)', type: 'number', required: true, min: 1, step: 1 },
        { key: 'dueDate', label: '배송 예정일', type: 'date', required: true },
    ]
    const data = query.data
    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-hud-text-primary">MRP · 발주 제안</h1>
            <p className="mt-1 text-sm text-hud-text-muted">Spring 실제 BOM·작업오더·재고·발주잔량 조회 · 계획 참고값이며 재고 예약이 아닙니다.</p></div>
        <HudCard title="계획 조회" headingLevel={2}>
            <form className="flex flex-wrap items-end gap-4" onSubmit={e => { e.preventDefault(); setPage(0); if (through === appliedThrough) { void query.refetch() } else setAppliedThrough(through) }}>
                <label className="text-sm">계획 종료일<DateInput aria-label="계획 종료일" className="mt-1 rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary" value={through} required
                    min={seoulToday()} max={addDateDays(seoulToday(), 365)} onChange={e => setThrough(e.target.value)} /></label>
                <label className="text-sm">표시 품목<select aria-label="표시 품목" className="mt-1 block rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary" value={itemId} disabled={!items.ready}
                    onChange={e => { setItemId(e.target.value); setPage(0) }}><option value="">전체 품목</option>{items.options.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</select></label>
                <Button type="submit" disabled={query.isFetching || !through}>계획 재조회</Button>
            </form>{items.status}
        </HudCard>
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} loadingMessage="MRP를 계산하는 중...">
            {data && <>
                <p className="text-sm text-hud-text-muted">기준시각 {new Date(data.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울) · 계획 종료 {data.through} · 전체 활성 오더 {data.activeWorkOrders}건 · 발주 필요 {data.purchaseNeededItems}품목 · 생산 보충 {data.productionNeededItems}품목 · BOM 확인 {data.missingBomItems}품목</p>
                <HudCard title="품목별 소요와 공급 충당" headingLevel={2}>
                    {data.rows.length === 0 ? <p>해당 품목·페이지에 소요량 또는 보충 제안이 없습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
                        <caption className="sr-only">품목별 MRP 소요량과 가용재고 및 발주 제안</caption>
                        <thead><tr>{['품목', '소요량', '가용재고', '안전재고', '미입고 발주', '예정 생산', '지연 공급', '부족량', '발주 제안', '소요일 / 발주마감', '조치'].map(h => <th key={h} scope="col" className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                        <tbody>{data.rows.map(row => <tr key={row.itemId} className="border-t border-hud-border-secondary">
                            <th scope="row" className="p-2 text-left font-normal whitespace-nowrap">{row.itemNo}<br />{row.itemName}</th>
                            {[row.grossRequirement, row.usableStock, row.safetyStock, row.onOrder, row.scheduledProduction, row.lateSupplyQty, row.netRequirement, row.suggestedPurchaseQty].map((q, n) => <td key={n} className="p-2 font-mono whitespace-nowrap">{amount(q, row.unit)}</td>)}
                            <td className="p-2 whitespace-nowrap">{row.requiredBy}<br />{row.orderBy}{row.urgent && <span className="block text-hud-accent-warning">발주마감 경과</span>}</td>
                            <td className="p-2 whitespace-nowrap"><p className="mb-2">{actions[row.action]}</p>{canWrite && row.suggestedPurchaseQty > 0 && <Button size="sm" variant="outline" disabled={!vendors.ready || create.isPending} onClick={() => open(row)}>발주 전환</Button>}</td>
                        </tr>)}</tbody>
                    </table></div>}
                    <div className="mt-4 flex items-center gap-3"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>이전</Button>
                        <span className="text-sm">{page + 1} / {Math.max(1, data.totalPages)} 페이지 · {data.totalElements}품목</span>
                        <Button variant="outline" disabled={page + 1 >= data.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>다음</Button></div>
                </HudCard>
                {canWrite && vendors.status}
                <HudCard title="계산 근거와 제약" headingLevel={2}><ul className="list-disc space-y-2 pl-5 text-xs text-hud-text-muted">{data.notes.map(note => <li key={note}>{note}</li>)}</ul></HudCard>
            </>}
        </AsyncState>
        {created && <HudCard title="등록된 실제 발주" headingLevel={2}><div role="status" className="space-y-2 text-sm">
            <p>{created.purchaseOrderNo} · {created.vendorName} · {created.itemNo} · {created.qty.toLocaleString()} · {created.amount.toLocaleString()}원 · {created.dueDate} · {created.status}</p>
            <p>발주가 DB에 저장됐습니다. 현재고는 변하지 않으며, 새 발주잔량이 다음 MRP에 반영됩니다.</p>
            <Link to="/purchase/receiving" className="text-hud-accent-primary underline">실제 발주 선택·입고 화면</Link>
        </div></HudCard>}
        <FormModal isOpen={target !== null} onClose={() => { if (!create.isPending) setTarget(null) }} title="MRP 제안 발주 전환"
            subtitle={`${target?.itemNo ?? ''} · ${target?.itemName ?? ''} · 발주처를 직접 선택하고 기준단가와 배송일을 확인하세요. 오래된 제안은 먼저 재조회하세요.`}
            fields={fields} values={values} onChange={(key, value) => setValues(v => ({ ...v, [key]: value }))}
            onSubmit={() => create.mutate()} isSubmitting={create.isPending} submitLabel="발주 확정"
            error={create.error ? <><p>{create.error instanceof ApiError ? create.error.message : '발주를 등록하지 못했습니다.'}</p>{create.error instanceof ApiError && create.error.traceId && <p>Trace ID: {create.error.traceId}</p>}</> : undefined} />
    </div>
}
