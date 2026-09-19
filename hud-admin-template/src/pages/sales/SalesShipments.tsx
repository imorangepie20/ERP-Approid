import { Plus, Truck } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon, statusTone } from '../../store/DataContext'
import type { Shipment } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'

const SalesShipments = () => {
    const shipments = useCollection('shipments')
    const { salesOrders, items, create, update, remove, confirmShipment } = useData()

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<Shipment>({
        title: '출하',
        subtitle: '수주를 선택하고 출하 정보를 입력하세요.',
        onCreate: values => {
            const so = salesOrders.find(s => s.id === values.salesOrder)
            if (!so) return
            create('shipments', {
                id: nextId('SH', shipments),
                salesOrder: so.id,
                customer: so.customer,
                item: so.item,
                qty: Number(values.qty) || so.qty,
                deliveryDate: values.deliveryDate,
                vehicle: values.vehicle,
                status: '지시',
                amount: so.amount,
            } as Shipment)
        },
        onUpdate: (id, values) => {
            update('shipments', id, {
                qty: Number(values.qty) || 0,
                deliveryDate: values.deliveryDate,
                vehicle: values.vehicle,
            })
        },
        onDelete: id => remove('shipments', id),
        fields: () => [
            {
                key: 'salesOrder', label: '수주번호', type: 'select', required: true,
                options: salesOrders
                    .filter(s => s.status === '확정' || s.status === '생산중')
                    .map(s => ({ label: `${s.id} · ${s.customer} · ${s.item}`, value: s.id })),
            },
            { key: 'qty', label: '출하 수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'deliveryDate', label: '배송일', type: 'date', required: true },
            { key: 'vehicle', label: '차량', type: 'text', placeholder: '화물차 11T' },
        ],
    })

    const handleConfirm = (sh: Shipment) => {
        confirmShipment(sh.id)
        window.alert(`${sh.id} 출하 확정 → 매출전표 생성 및 수주 완료되었습니다.`)
    }

    const columns: DataTableColumn<Shipment>[] = [
        { key: 'id', label: '출하번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'salesOrder', label: '수주번호', render: row => <span className="font-mono">{row.salesOrder}</span> },
        { key: 'customer', label: '고객사' },
        { key: 'item', label: '품목' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'amount', label: '금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'deliveryDate', label: '배송일' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)}>
                    {(row.status === '지시' || row.status === '배차') && (
                        <button
                            onClick={() => handleConfirm(row)}
                            title="출하 확정 → 매출 반영"
                            className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-success transition-hud"
                        >
                            <Truck size={14} />
                        </button>
                    )}
                </RowActions>
            )
        },
    ]

    const totalAmount = shipments.reduce((acc, s) => acc + s.amount, 0)

    return (
        <>
            <DataTable<Shipment>
                title="출하 관리"
                subtitle={`총 ${shipments.length}건 · 출하 금액 ${formatWon(totalAmount)}`}
                columns={columns}
                data={shipments}
                rowKey="id"
                searchPlaceholder="출하번호, 고객사, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                        출하 지시
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default SalesShipments
