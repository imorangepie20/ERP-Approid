import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMessageContact, saveMessageContact, type MessageContact } from '../../api/messages'
import { useAuth } from '../../auth/AuthContext'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'

const inputClass = 'w-full rounded border border-hud-border-secondary bg-hud-bg-primary p-2'
export default function MessageContactForm({ partnerId, partnerName }: { partnerId: number; partnerName: string }) {
    const { user, core } = useAuth()
    const canWrite = !!user?.roles.some(r => ['ADMIN', 'ACCOUNTING'].includes(r))
    const contactQuery = useQuery({ queryKey: ['messages', 'contact', partnerId], staleTime: 0,
        refetchOnWindowFocus: false, queryFn: () => fetchMessageContact(core, partnerId) })
    const contact: MessageContact | null = contactQuery.data?.contact ?? null
    return <section aria-label="독촉 수신 주소 등록" className="space-y-3 rounded border border-hud-border-secondary p-4">
        <h3 className="font-semibold">독촉 수신 주소 등록 · {partnerName}</h3>
        <AsyncState isLoading={contactQuery.isPending} error={contactQuery.error} onRetry={() => { void contactQuery.refetch() }}>
            {contactQuery.data && <>
                {contact ? <>
                    <p>등록 주소: {contact.email} · 상태: {contact.permission === 'ALLOWED' ? '허용' : contact.permission === 'BLOCKED' ? '차단됨' : '확인 대기'}</p>
                    {contact.permission !== 'ALLOWED' && <p role="note">허용된 연락처가 있어야 발송을 요청할 수 있습니다.</p>}
                </> : <>
                    <p>등록된 독촉 수신 주소가 없습니다.</p>
                    <p>허용된 연락처가 있어야 발송을 요청할 수 있습니다.</p>
                </>}
                {canWrite
                    ? <ContactEditor key={`${contact?.id ?? 'new'}-${contact?.version ?? 0}`} partnerId={partnerId} contact={contact} />
                    : contact && <label className="block">수신 이메일<input aria-label="수신 이메일" className={inputClass} value={contact.email} readOnly /></label>}
            </>}
        </AsyncState>
    </section>
}

function ContactEditor({ partnerId, contact }: { partnerId: number; contact: MessageContact | null }) {
    const { core } = useAuth()
    const queryClient = useQueryClient()
    const [email, setEmail] = useState(contact?.email ?? '')
    const [note, setNote] = useState('')
    const [acknowledged, setAcknowledged] = useState(false)
    const [notice, setNotice] = useState('')
    const save = useMutation({
        mutationFn: (input: { email: string; expectedVersion: number | null; confirmationNote: string; acknowledged: boolean }) =>
            saveMessageContact(core, partnerId, { ...input, permission: 'ALLOWED' }),
        onSuccess: () => { setNotice(''); void queryClient.invalidateQueries({ queryKey: ['messages', 'contact', partnerId] }) },
        onError: (error: unknown) => {
            const code = (error as { code?: string })?.code
            setNotice(code === 'DUPLICATE' ? '다른 담당자가 먼저 변경했습니다. 최신 정보를 다시 확인하세요.' : '저장에 실패했습니다. 다시 시도하세요.')
        },
    })
    return <form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate({ email: email.trim(), expectedVersion: contact?.version ?? null, confirmationNote: note.trim(), acknowledged }) }}>
        <label className="block">수신 이메일<input aria-label="수신 이메일" className={inputClass} value={email} maxLength={254} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="block">수신 확인 근거 (최대 256자)<input aria-label="수신 확인 근거" className={inputClass} value={note} maxLength={256} onChange={e => setNote(e.target.value)} required /></label>
        <label className="block"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> 수신자가 업무 안내 수신을 확인했습니다.</label>
        <Button type="submit" variant="primary" disabled={save.isPending}>연락처 저장</Button>
        {notice && <p role="alert">{notice}</p>}
    </form>
}
