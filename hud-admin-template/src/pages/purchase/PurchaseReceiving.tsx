import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, statusTone } from '../../store/DataContext'
import type { Receiving } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'

const PurchaseReceiving = () => {
    const receivings = useCollection('receivings')
    const { purchaseOrders, remove, receivePurchaseOrder } = useData()

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<Receiving>({
        title: '입고',
        subtitle: '발주번호를 선택하고 입고 수량을 입력하세요.',
        onCreate: values => {
            const po = purchaseOrders.find(p => p.id === values.purchaseOrder)
            if (!po) return
            const rcv = Number(values.receivedQty) || 0
            const def = Number(values.defectQty) || 0
            receivePurchaseOrder(po.id, rcv, def)
        },
        onUpdate: () => {
            window.alert('입고 이력은 수정할 수 없습니다. 삭제 후 재등록하세요.')
        },
        onDelete: id => remove('receivings', id),
        fields: () => [
            {
                key: 'purchaseOrder', label: '발주번호', type: 'select', required: true,
                options: purchaseOrders
                    .filter(p => p.status !== '입고완료' && p.status !== '취소')
                    .map(p => ({ label: `${p.id} · ${p.vendor} · ${p.item} (잔량 ${p.qty - p.receivedQty})`, value: p.id })),
            },
            { key: 'receivedQty', label: '입고 수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'defectQty', label: '불량 수량', type: 'number', min: 0, step: 1 },
            { key: 'date', label: '입고일', type: 'date', required: true },
        ],
    })

    const columns: DataTableColumn<Receiving>[] = [
        { key: 'id', label: '입고번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'purchaseOrder', label: '발주번호', render: row => <span className="font-mono">{row.purchaseOrder}</span> },
        { key: 'vendor', label: '발주처' },
        { key: 'item', label: '품목' },
        { key: 'orderQty', label: '발주수량', render: row => <span className="font-mono">{row.orderQty.toLocaleString()}</span> },
        { key: 'receivedQty', label: '입고수량', render: row => <span className="font-mono text-hud-text-primary">{row.receivedQty.toLocaleString()}</span> },
        { key: 'defectQty', label: '불량', render: row => <span className={`font-mono ${row.defectQty > 0 ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.defectQty.toLocaleString()}</span> },
        { key: 'date', label: '입고일' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => <RowActions onDelete={() => confirmDelete(row)} />
        },
    ]

    return (
        <>
            <DataTable<Receiving>
                title="입고 관리"
                subtitle={`총 ${receivings.length}건`}
                columns={columns}
                data={receivings}
                rowKey="id"
                searchPlaceholder="입고번호, 발주처, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                        입고 등록
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default PurchaseReceiving
