package com.erpapproid.core.api.messaging;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.erpapproid.core.domain.messaging.PartnerMessageContactEntity;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MessageHashes {
    private final ObjectMapper mapper;

    public String snapshot(ReceivableEntity r, PartnerMessageContactEntity c, LocalDate today) {
        var fields = new LinkedHashMap<String,Object>();
        fields.put("receivableId",r.getId()); fields.put("receivableNo",r.getReceivableNo());
        fields.put("customerId",r.getCustomer().getId()); fields.put("customerName",r.getCustomer().getName());
        fields.put("dueDate",r.getDueDate().toString()); fields.put("status",r.getStatus());
        fields.put("amount",r.getAmount()); fields.put("collectedAmount",r.getCollectedAmount());
        fields.put("remainingAmount",r.getAmount()-r.getCollectedAmount()); fields.put("referenceDate",today.toString());
        fields.put("contactId",c == null ? null : c.getId()); fields.put("email",c == null ? null : c.getEmail());
        fields.put("contactVersion",c == null ? null : c.getVersion());
        fields.put("permission",c == null ? null : c.getPermission().name());
        return hash(fields);
    }
    public String input(Long actor, Long receivable, Long contact, String expectedHash, String note, boolean acknowledged) {
        var fields = new LinkedHashMap<String,Object>();
        fields.put("actorId",actor); fields.put("receivableId",receivable); fields.put("contactId",contact);
        fields.put("expectedSnapshotHash",expectedHash); fields.put("note",note); fields.put("acknowledged",acknowledged);
        return hash(fields);
    }
    public String hash(Map<String,?> fields) {
        try {
            String json=mapper.writer().without(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsString(fields);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Message hash generation failed");
        }
    }
}
