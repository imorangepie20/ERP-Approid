import { useMemo } from 'react'
import { ShoppingCart, TrendingDown, Clock, Package } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'
import { useData, useCollection, nextId } from '../../store/DataContext'
import type { MrpSuggestion } from '../../store/types'

const PurchaseMrp = () => {
    const items = useCollection('items')
    const { purchaseOrders, create, workOrders } = useData()

    // ============================================================
    // MRP 연산: BOM 전개 → 자재 소요량 → 재고/리드타임 기반 발주 제안
    // ============================================================
    const suggestions = useMemo<MrpSuggestion[]>(() => {
        const materialItems = items.filter(i => i.type === '자재')
        return materialItems.map((mi, index) => {
            // 진행중인 작업오더 기준 소요량(단순화: 작업오더 수량 × 안전재고 정책)
            const activeQty = workOrders
                .filter(w => w.status === '진행중' || w.status === '지시')
                .reduce((acc, w) => acc + w.qty, 0)
            const requirement = Math.round(activeQty * 0.5)
            const shortfall = Math.max(0, requirement + mi.safetyStock - mi.stock)
            const reorderPoint = mi.safetyStock + Math.round(requirement * (mi.leadTime / 30))
            const suggestedQty = shortfall > 0 ? Math.ceil(shortfall * 1.1) : 0

            return {
                id: `MRP-${String(index + 1).padStart(3, '0')}`,
                item: mi.name,
                unit: mi.unit,
                requirement,
                onHand: mi.stock,
                shortfall,
                reorderPoint,
                leadTime: mi.leadTime,
                suggestedQty,
                reason: shortfall > 0
                    ? `안전재고 ${mi.safetyStock} + 소요 ${requirement} 대비 부족 (${shortfall}${mi.unit})`
                    : '충분한 재고 보유',
            }
        })
    }, [items, workOrders])

    const needOrder = suggestions.filter(s => s.suggestedQty > 0)

    const handleCreatePo = (s: MrpSuggestion) => {
        const vendor = purchaseOrders.find(p => p.item === s.item)?.vendor ?? '대한강철'
        create('purchaseOrders', {
            id: nextId('PO', purchaseOrders),
            vendor,
            item: s.item,
            qty: s.suggestedQty,
            unitPrice: items.find(i => i.name === s.item)?.price ?? 0,
            amount: s.suggestedQty * (items.find(i => i.name === s.item)?.price ?? 0),
            dueDate: new Date(Date.now() + s.leadTime * 86400000).toISOString().slice(0, 10),
            status: '발주',
            receivedQty: 0,
        })
        window.alert(`${s.item} 발주가 생성되었습니다.`)
    }

    const handleCreateAll = () => {
        needOrder.forEach((s, idx) => {
            const vendor = purchaseOrders.find(p => p.item === s.item)?.vendor ?? '대한강철'
            const price = items.find(i => i.name === s.item)?.price ?? 0
            create('purchaseOrders', {
                id: `${nextId('PO', purchaseOrders)}-${idx}`,
                vendor,
                item: s.item,
                qty: s.suggestedQty,
                unitPrice: price,
                amount: s.suggestedQty * price,
                dueDate: new Date(Date.now() + s.leadTime * 86400000).toISOString().slice(0, 10),
                status: '발주',
                receivedQty: 0,
            })
        })
        window.alert(`${needOrder.length}건의 발주가 일괄 생성되었습니다.`)
    }

    const columns: DataTableColumn<MrpSuggestion>[] = [
        { key: 'item', label: '자재', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'onHand', label: '현재고', render: row => <span className="font-mono">{row.onHand.toLocaleString()} {row.unit}</span> },
        { key: 'requirement', label: '소요량', render: row => <span className="font-mono">{row.requirement.toLocaleString()} {row.unit}</span> },
        { key: 'reorderPoint', label: '발주점', render: row => <span className="font-mono text-hud-text-muted">{row.reorderPoint.toLocaleString()} {row.unit}</span> },
        {
            key: 'shortfall', label: '부족량',
            render: row => <span className={`font-mono ${row.shortfall > 0 ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.shortfall.toLocaleString()} {row.unit}</span>
        },
        { key: 'leadTime', label: '리드타임', render: row => <span className="font-mono">{row.leadTime}일</span> },
        {
            key: 'suggestedQty', label: '제안 발주량',
            render: row => row.suggestedQty > 0
                ? <span className="font-mono text-hud-accent-primary">{row.suggestedQty.toLocaleString()} {row.unit}</span>
                : <span className="text-hud-text-muted text-xs">-</span>
        },
        { key: 'reason', label: '사유', render: row => <span className="text-xs text-hud-text-muted">{row.reason}</span> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => row.suggestedQty > 0 ? (
                <Button variant="outline" size="sm" onClick={() => handleCreatePo(row)}>
                    발주 전환
                </Button>
            ) : <span className="text-hud-text-muted text-xs">-</span>
        },
    ]

    return (
        <>
            <DataTable<MrpSuggestion>
                title="MRP · 발주 제안"
                subtitle="BOM 전개 소요량과 리드타임을 기반으로 발주 시점/수량을 제안합니다."
                columns={columns}
                data={suggestions}
                rowKey="id"
                searchPlaceholder="자재명 검색..."
                toolbar={
                    <Button
                        variant="primary"
                        glow
                        disabled={needOrder.length === 0}
                        onClick={handleCreateAll}
                    >
                        제안 일괄 발주 ({needOrder.length}건)
                    </Button>
                }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                <StatCard title="분석 자재 수" value={suggestions.length.toString()} icon={<Package size={24} />} variant="primary" />
                <StatCard title="발주 필요" value={needOrder.length.toString()} icon={<TrendingDown size={24} />} variant="danger" />
                <StatCard title="총 부족량" value={needOrder.reduce((acc, s) => acc + s.shortfall, 0).toLocaleString()} icon={<ShoppingCart size={24} />} variant="warning" />
                <StatCard title="최장 리드타임" value={`${Math.max(0, ...suggestions.map(s => s.leadTime))}일`} icon={<Clock size={24} />} variant="secondary" />
            </div>
            <HudCard title="발주점 산출 근거" subtitle="desc.md: 발주점 = 안전재고 + 소비 × 리드타임" className="mt-6">
                <p className="text-sm text-hud-text-secondary leading-relaxed">
                    발주점은 <span className="font-mono text-hud-accent-primary">안전재고 + 일평균 소비량 × 리드타임</span>으로 산출됩니다.
                    현재고가 발주점 이하로 떨어지면 리드타임 내 도착하도록 발주 수량을 제안하며,
                    제안된 수량은 <span className="font-mono">단가 × 수량</span>으로 발주서를 생성합니다.
                </p>
            </HudCard>
        </>
    )
}

export default PurchaseMrp
