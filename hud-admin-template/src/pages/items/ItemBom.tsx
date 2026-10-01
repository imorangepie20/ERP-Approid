import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId } from '../../store/DataContext'
import type { Bom } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'
import { Authorize } from '../../auth/authorization'
import { useAuth } from '../../auth/AuthContext'

const ItemBom = () => {
    const boms = useCollection('boms')
    const { items, create, update, remove } = useData()
    const { user } = useAuth()
    const roles = user?.roles ?? []

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<Bom>({
        title: 'BOM',
        subtitle: '모품목-자품목 소요량과 손실율을 입력하세요.',
        onCreate: values => {
            const child = items.find(i => i.id === values.child)
            create('boms', {
                id: values.id || nextId('BOM', boms),
                parent: values.parent,
                child: values.child,
                childName: child?.name ?? values.child,
                qty: Number(values.qty) || 0,
                loss: Number(values.loss) || 0,
                childType: child?.type ?? '자재',
                substitute: values.substitute || '-',
            } as Bom)
        },
        onUpdate: (id, values) => {
            const child = items.find(i => i.id === values.child)
            update('boms', id, {
                parent: values.parent,
                child: values.child,
                childName: child?.name ?? values.child,
                qty: Number(values.qty) || 0,
                loss: Number(values.loss) || 0,
                substitute: values.substitute || '-',
            })
        },
        onDelete: id => remove('boms', id),
        fields: () => [
            {
                key: 'parent', label: '모품목', type: 'select', required: true,
                options: items.filter(i => i.type !== '자재').map(i => ({ label: `${i.name} (${i.id})`, value: i.id })),
            },
            {
                key: 'child', label: '자품목', type: 'select', required: true,
                options: items.map(i => ({ label: `${i.name} (${i.id})`, value: i.id })),
            },
            { key: 'qty', label: '소요량', type: 'number', required: true, min: 0, step: 0.1 },
            { key: 'loss', label: '손실율(%)', type: 'number', min: 0, step: 0.1 },
            { key: 'substitute', label: '대체자재', type: 'text', placeholder: 'M-S001-A' },
        ],
    })

    const columns: DataTableColumn<Bom>[] = [
        { key: 'id', label: 'BOM ID', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'parent', label: '모품목', render: row => <span className="font-mono">{row.parent}</span> },
        { key: 'childName', label: '자품목', render: row => (
            <div>
                <span className="text-hud-text-primary">{row.childName}</span>
                <p className="text-xs text-hud-text-muted font-mono">{row.child}</p>
            </div>
        ) },
        { key: 'qty', label: '소요량', render: row => <span className="font-mono">{row.qty}</span> },
        { key: 'loss', label: '손실율', render: row => <span className="font-mono text-hud-text-muted">{row.loss}%</span> },
        { key: 'childType', label: '자품목 유형' },
        { key: 'substitute', label: '대체자재', render: row => <span className="font-mono text-hud-text-muted">{row.substitute}</span> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <div className="flex items-center justify-end gap-1">
                    <Authorize roles={roles} anyOf={['ADMIN', 'PRODUCTION']}>
                        <RowActions onEdit={() => openEdit(row)} />
                    </Authorize>
                    <Authorize roles={roles} anyOf={['ADMIN']}>
                        <RowActions onDelete={() => confirmDelete(row)} />
                    </Authorize>
                </div>
            )
        },
    ]

    return (
        <>
            <DataTable<Bom>
                title="BOM 관리"
                subtitle={`총 ${boms.length}건`}
                columns={columns}
                data={boms}
                rowKey="id"
                searchPlaceholder="모품목, 자품목 검색..."
                toolbar={
                    <Authorize roles={roles} anyOf={['ADMIN', 'PRODUCTION']}>
                        <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                            BOM 등록
                        </Button>
                    </Authorize>
                }
            />
            {modal}
        </>
    )
}

export default ItemBom
