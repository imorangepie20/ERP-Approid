package com.erpapproid.core.api.sales;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.Locale;
import com.erpapproid.core.domain.sales.ReceivableEntity;

public final class ReminderEmailTemplate {
    public static final String VERSION="RECEIVABLE_REMINDER_EMAIL_V1";
    private ReminderEmailTemplate() {}
    public static String subject(ReceivableEntity r) { return "미수금 확인 요청 — " + r.getReceivableNo(); }
    public static String body(ReceivableEntity r, LocalDate today, String note) {
        String balance=NumberFormat.getIntegerInstance(Locale.KOREA).format(r.getAmount()-r.getCollectedAmount());
        return r.getCustomer().getName()+" 담당자님,\n청구번호: "+r.getReceivableNo()+"\n수납기일: "+r.getDueDate()
                +"\n현재 미수 잔액: "+balance+"원\n조회 기준일: "+today+" (서울)\n이미 입금하셨다면 담당자에게 확인을 부탁드립니다."
                +(note.isEmpty()?"":"\n\n"+note);
    }
}
