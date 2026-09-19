import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon, statusTone } from '../../store/DataContext'
import type { WorkOrder } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'

const ProductionOrders = () => {
    const workOrders = useCollection('workOrders')
    const { items, salesOrders, create, update, remove, completeWorkOrder } = useData()

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<WorkOrder>({
        title: '작업오더',
        subtitle: '제품·수량·착수/완료일을 입력하세요.',
        onCreate: values => {
            const qty = Number(values.qty) || 0
            create('workOrders', {
                id: nextId('WO', workOrders),
                salesOrderId: values.salesOrderId || undefined,
                item: values.item,
                qty,
                goodQty: 0,
                defectQty: 0,
                startDate: values.startDate,
                dueDate: values.dueDate,
                progress: 0,
                status: '지시',
            } as WorkOrder)
        },
        onUpdate: (id, values) => {
            const qty = Number(values.qty) || 0
            update('workOrders', id, {
                salesOrderId: values.salesOrderId || undefined,
                item: values.item,
                qty,
                startDate: values.startDate,
                dueDate: values.dueDate,
            })
        },
        onDelete: id => remove('workOrders', id),
        fields: () => [
            {
                key: 'item', label: '품목', type: 'select', required: true,
                options: items.map(i => ({ label: `${i.name} (${i.id})`, value: i.name })),
            },
            {
                key: 'salesOrderId', label: '연결 수주', type: 'select',
                options: salesOrders
                    .filter(s => s.status === '확정' || s.status === '대기')
                    .map(s => ({ label: `${s.id} · ${s.customer}`, value: s.id })),
            },
            { key: 'qty', label: '지시수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'startDate', label: '착수일', type: 'date', required: true },
            { key: 'dueDate', label: '완료예정', type: 'date', required: true },
        ],
    })

    const handleComplete = (wo: WorkOrder) => {
        if (wo.goodQty === 0) {
            window.alert('양품 수량이 0건입니다. 진척 입력 후 완료하세요.')
            return
        }
        completeWorkOrder(wo.id)
        window.alert(`${wo.id} 완료 처리 → 완제품 LOT 입고 및 원가 집계되었습니다.`)
    }

    const columns: DataTableColumn<WorkOrder>[] = [
        { key: 'id', label: '작업오더', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'qty', label: '지시수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'goodQty', label: '양품', render: row => <span className="font-mono text-hud-accent-success">{row.goodQty.toLocaleString()}</span> },
        { key: 'defectQty', label: '불량', render: row => <span className={`font-mono ${row.defectQty > 0 ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.defectQty.toLocaleString()}</span> },
        {
            key: 'progress', label: '진척률',
            render: row => (
                <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full" style={{ width: `${row.progress}%` }} />
                    </div>
                    <span className="font-mono text-xs text-hud-text-secondary">{row.progress}%</span>
                </div>
            )
        },
        { key: 'dueDate', label: '완료예정' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)}>
                    {(row.status === '진행중' || row.status === '지시') && (
                        <button
                            onClick={() => handleComplete(row)}
                            title="완료 → LOT 입고 + 원가 집계"
                            className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-success transition-hud"
                        >
                            ✓
                        </button>
                    )}
                </RowActions>
            )
        },
    ]

    return (
        <>
            <DataTable<WorkOrder>
                title="작업오더"
                subtitle={`총 ${workOrders.length}건 · 진행중 ${workOrders.filter(w => w.status === '진행중').length}건`}
                columns={columns}
                data={workOrders}
                rowKey="id"
                searchPlaceholder="작업오더, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                        오더 등록
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default ProductionOrders
