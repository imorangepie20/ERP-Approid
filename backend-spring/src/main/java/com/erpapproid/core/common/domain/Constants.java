package com.erpapproid.core.common.domain;

/**
 * 도메인 상태/창고/거래 유형 상수. db-schema.md 의 CHECK 제약값과 1:1.
 */
public final class Constants {

    private Constants() {
    }

    public static final String DRAFT = "작성중";
    public static final String SENT = "발송완료";
    public static final String ORDERED = "수주완료";
    public static final String EXPIRED = "만료";

    public static final String WAITING = "대기";
    public static final String CONFIRMED = "확정";
    public static final String IN_PRODUCTION = "생산중";
    public static final String SHIPPED = "출하완료";
    public static final String CANCELLED = "취소";

    public static final String DISPATCH = "지시";
    public static final String DISPATCHED = "배차";
    public static final String SHIP_DONE = "출하완료";
    public static final String REVENUE_RECOGNIZED = "매출반영";

    public static final String OPEN = "미수";
    public static final String COLLECTED = "수납완료";
    public static final String OVERDUE = "연체";

    public static final String PRODUCT = "제품";
    public static final String SEMI = "반제품";
    public static final String MATERIAL = "자재";

    public static final String WAREHOUSE_MATERIAL = "자재창고";
    public static final String WAREHOUSE_SEMI = "반제품창고";
    public static final String WAREHOUSE_PRODUCT = "완제품창고";

    public static final String TXN_RECEIVE = "입고";
    public static final String TXN_PRODUCTION_RECEIVE = "생산입고";
    public static final String TXN_ISSUE = "출고";
    public static final String TXN_SHIP = "출하";
    public static final String TXN_MOVE = "이동";
    public static final String TXN_ADJUST = "실사";

    public static final String PO_OPEN = "발주";
    public static final String PO_PARTIAL = "부분입고";
    public static final String PO_CLOSED = "입고완료";
    public static final String PO_CANCEL = "취소";

    public static final String RC_INSPECT = "검수중";
    public static final String RC_PASS = "합격";
    public static final String RC_PARTIAL = "부분합격";
    public static final String RC_RETURN = "반품";
    public static final String RC_FAIL = "불합격";
    public static final String RC_CANCEL = "취소";

    public static final String WO_OPEN = "지시";
    public static final String WO_PROGRESS = "진행중";
    public static final String WO_DONE = "완료";
    public static final String WO_CLOSED = "마감";
    public static final String WO_CANCEL = "취소";

    public static final String PLAN_DRAFT = "계획";
    public static final String PLAN_CONFIRMED = "확정";
    public static final String PLAN_CLOSED = "종결";

    public static final String LOT_OK = "정상";
    public static final String LOT_HOLD = "보류";
    public static final String LOT_EXPIRING = "유통기한임박";
    public static final String LOT_DISPOSED = "폐기";
}
