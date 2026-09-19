import { AlertTriangle, Boxes, Package, Layers } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'
import { useCollection } from '../../store/DataContext'
import { useMemo } from 'react'

interface StockRow {
    id: string
    item: string
    warehouse: string
    available: number
    defect: number
    safety: number
    unit: string
    lastIn: string
}

const InventoryStock = () => {
    const items = useCollection('items')

    const stockRows = useMemo<StockRow[]>(() => items.map(i => ({
        id: i.id,
        item: i.name,
        warehouse: i.type === '자재' ? '자재창고' : i.type === '반제품' ? '반제품창고' : '완제품창고',
        available: i.stock,
        defect: 0,
        safety: i.safetyStock,
        unit: i.unit,
        lastIn: '-',
    })), [items])

    const lowStockItems = useMemo(() => stockRows.filter(s => s.available < s.safety), [stockRows])

    const columns: DataTableColumn<StockRow>[] = [
        { key: 'id', label: '품번', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'warehouse', label: '창고' },
        { key: 'available', label: '가능재고', render: row => (
            <span className={`font-mono ${row.available < row.safety ? 'text-hud-accent-danger' : 'text-hud-text-primary'}`}>
                {row.available.toLocaleString()}
            </span>
        ) },
        { key: 'safety', label: '안전재고', render: row => <span className="font-mono text-hud-text-muted">{row.safety.toLocaleString()}</span> },
        { key: 'unit', label: '단위' },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">재고 현황</h1>
                <p className="text-hud-text-muted mt-1">창고별 가용 재고와 안전재고 대비 현황을 관리합니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="재고 품목 수" value={stockRows.length.toString()} icon={<Boxes size={24} />} variant="primary" />
                <StatCard title="안전재고 미달" value={lowStockItems.length.toString()} icon={<AlertTriangle size={24} />} variant="danger" />
                <StatCard title="창고 수" value="3" icon={<Layers size={24} />} variant="secondary" />
                <StatCard title="자재 품목 수" value={items.filter(i => i.type === '자재').length.toString()} icon={<Package size={24} />} variant="warning" />
            </div>

            <HudCard title="안전재고 미달 품목" subtitle="발주 필요 품목 목록">
                {lowStockItems.length === 0 ? (
                    <p className="text-sm text-hud-text-muted">안전재고 미달 품목이 없습니다.</p>
                ) : (
                    <div className="space-y-3">
                        {lowStockItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-hud-accent-danger/5 border border-hud-accent-danger/20">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={18} className="text-hud-accent-danger" />
                                    <div>
                                        <span className="text-sm text-hud-text-primary">{item.item}</span>
                                        <p className="text-xs text-hud-text-muted font-mono">{item.id} · {item.warehouse}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-mono text-hud-accent-danger">{item.available.toLocaleString()} {item.unit}</span>
                                    <p className="text-xs text-hud-text-muted">안전재고 {item.safety.toLocaleString()} {item.unit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </HudCard>

            <DataTable<StockRow>
                columns={columns}
                data={stockRows}
                rowKey="id"
                searchPlaceholder="품번, 품목, 창고 검색..."
            />
        </div>
    )
}

export default InventoryStock
