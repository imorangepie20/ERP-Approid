package com.erpapproid.core.api.messaging;

import java.util.Locale;
import java.util.regex.Pattern;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;

public final class EmailAddresses {
    private static final String ATOM = "[A-Za-z0-9!#$%&'*+/=?^_\\x60{|}~-]+";
    private static final Pattern LOCAL = Pattern.compile(ATOM + "(?:\\." + ATOM + ")*");
    private static final Pattern LABEL = Pattern.compile("[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?");
    private EmailAddresses() {}

    public static String normalize(String email) {
        if (email == null || email.length() > 254 || email.chars().anyMatch(c -> c < 33 || c > 126)) throw invalid();
        int at = email.indexOf('@');
        if (at < 1 || at != email.lastIndexOf('@') || at > 64) throw invalid();
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        String[] labels = domain.split("\\.", -1);
        if (!LOCAL.matcher(local).matches() || labels.length < 2) throw invalid();
        for (String label : labels) if (!LABEL.matcher(label).matches()) throw invalid();
        return local + "@" + domain.toLowerCase(Locale.ROOT);
    }
    private static DomainException invalid() {
        return new DomainException(ErrorCode.INVALID_INPUT, "줄바꿈 없는 ASCII 단일 이메일 주소를 입력하세요.");
    }
}
