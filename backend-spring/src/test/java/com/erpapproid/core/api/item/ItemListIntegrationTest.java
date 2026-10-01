package com.erpapproid.core.api.item;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class ItemListIntegrationTest extends IntegrationTestSupport {

    private static final String MATERIAL_ITEM_TYPE = "\uC790\uC7AC";

    @Autowired
    private ItemRepository itemRepository;

    @Test
    void anonymous_list_request_is_rejected() {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items", HttpMethod.GET, jsonEntity(null), JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void authenticated_list_searches_item_number_and_name_keywords() {
        createUser("items-sales", "password123", "SALES");
        String token = login("items-sales", "password123");

        ResponseEntity<JsonNode> byItemNumber = get(
                "/api/core/items?keyword=m-s001&sort=itemNo,asc", token);
        ResponseEntity<JsonNode> byName = get(
                "/api/core/items?keyword=3.0mm&sort=itemNo,asc", token);

        assertThat(byItemNumber.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(byItemNumber.getBody()).isNotNull();
        assertThat(byItemNumber.getBody().get("totalElements").asLong()).isEqualTo(1);
        assertThat(itemNumbers(byItemNumber.getBody())).containsExactly("M-S001");

        assertThat(byName.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(byName.getBody()).isNotNull();
        assertThat(byName.getBody().get("totalElements").asLong()).isEqualTo(1);
        assertThat(itemNumbers(byName.getBody())).containsExactly("M-S001");
    }

    @Test
    void authenticated_list_filters_item_type_and_sorts_stably_by_item_number() {
        String token = loginAdmin();

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?itemType={itemType}&sort=itemNo,asc",
                HttpMethod.GET,
                authEntity(token, null),
                JsonNode.class,
                MATERIAL_ITEM_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("totalElements").asLong()).isEqualTo(3);
        assertThat(itemNumbers(response.getBody())).containsExactly("M-C001", "M-S001", "M-S002");
        assertThat(response.getBody().get("content"))
                .allSatisfy(item -> assertThat(item.get("itemType").asText())
                        .isEqualTo(MATERIAL_ITEM_TYPE));
    }

    @Test
    void blank_item_type_is_treated_as_no_filter() {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?itemType={itemType}&sort=itemNo,asc",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                "   ");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("totalElements").asLong()).isEqualTo(8);
    }

    @ParameterizedTest
    @ValueSource(strings = {"\uC81C\uD488", "\uBC18\uC81C\uD488", "\uC790\uC7AC"})
    void supported_item_types_are_allowed(String itemType) {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?itemType={itemType}&sort=itemNo,asc",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                itemType);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("content"))
                .allSatisfy(item -> assertThat(item.get("itemType").asText()).isEqualTo(itemType));
    }

    @ParameterizedTest
    @ValueSource(strings = {"service", "\uC0C1\uD488", "\uC81C\uD488 "})
    void unsupported_item_types_are_rejected_without_echoing_input(String itemType) {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?itemType={itemType}",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                itemType);

        assertInvalidInput(response);
        assertThat(response.getBody().toString()).doesNotContain(itemType);
    }

    @Test
    void oversized_item_type_is_rejected_without_echoing_input() {
        String itemType = "x".repeat(129);

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?itemType={itemType}",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                itemType);

        assertInvalidInput(response);
        assertThat(response.getBody().toString()).doesNotContain(itemType);
    }

    @Test
    void authenticated_list_uses_zero_based_pages_and_returns_page_metadata() {
        String token = loginAdmin();

        ResponseEntity<JsonNode> response = get(
                "/api/core/items?page=1&size=3&sort=itemNo,asc", token);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        JsonNode page = response.getBody();
        assertThat(itemNumbers(page)).containsExactly("P-A001", "P-B002", "P-C003");
        assertThat(page.get("number").asInt()).isEqualTo(1);
        assertThat(page.get("size").asInt()).isEqualTo(3);
        assertThat(page.get("numberOfElements").asInt()).isEqualTo(3);
        assertThat(page.get("totalElements").asLong()).isEqualTo(8);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
        assertThat(page.get("first").asBoolean()).isFalse();
        assertThat(page.get("last").asBoolean()).isFalse();
        assertThat(page.get("pageable").get("pageNumber").asInt()).isEqualTo(1);
        assertThat(page.get("pageable").get("pageSize").asInt()).isEqualTo(3);
    }

    @Test
    void duplicate_primary_sort_values_use_item_number_ascending_across_pages() {
        String originalItemNumber = "P-D004";
        ItemEntity item = itemRepository.findByItemNo(originalItemNumber).orElseThrow();
        Long itemId = item.getId();
        item.setItemNo("P-0000");
        itemRepository.saveAndFlush(item);

        try {
            ResponseEntity<JsonNode> firstPage = itemTypePage("\uC81C\uD488", 0, 2, "itemType,desc");
            ResponseEntity<JsonNode> secondPage = itemTypePage("\uC81C\uD488", 1, 2, "itemType,desc");

            assertThat(firstPage.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(secondPage.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(itemNumbers(firstPage.getBody())).containsExactly("P-0000", "P-A001");
            assertThat(itemNumbers(secondPage.getBody())).containsExactly("P-B002", "P-C003");
        } finally {
            ItemEntity persistedItem = itemRepository.findById(itemId).orElseThrow();
            persistedItem.setItemNo(originalItemNumber);
            itemRepository.saveAndFlush(persistedItem);
        }
    }

    @Test
    void keyword_longer_than_128_characters_is_rejected_without_echoing_input() {
        String token = loginAdmin();
        String keyword = "x".repeat(129);

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?keyword={keyword}",
                HttpMethod.GET,
                authEntity(token, null),
                JsonNode.class,
                keyword);

        assertInvalidInput(response);
        assertThat(response.getBody().toString()).doesNotContain(keyword);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/core/items?size=0",
            "/api/core/items?size=101",
            "/api/core/items?page=-1",
            "/api/core/items?page=10001",
            "/api/core/items?sort=itemNo,sideways",
            "/api/core/items?sort=itemNo,asc,extra"
    })
    void invalid_page_size_or_sort_direction_is_rejected(String path) {
        ResponseEntity<JsonNode> response = get(path, loginAdmin());

        assertInvalidInput(response);
    }

    @ParameterizedTest
    @ValueSource(strings = {"createdAt", "createdBy", "createdBy.name", "doesNotExist"})
    void unsupported_or_nested_sort_properties_are_rejected(String property) {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?sort={sort}",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                property + ",asc");

        assertInvalidInput(response);
        assertThat(response.getBody().toString()).doesNotContain(property);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "itemNo", "name", "spec", "itemType", "unit", "price", "stock", "safetyStock"
    })
    void ui_sort_properties_are_allowed(String property) {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?size=1&sort={sort}",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                property + ",desc");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @ParameterizedTest
    @ValueSource(strings = {"%", "_"})
    void keyword_treats_sql_like_wildcards_as_literals(String keyword) {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items?keyword={keyword}&sort=itemNo,asc",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                keyword);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("totalElements").asLong()).isZero();
        assertThat(itemNumbers(response.getBody())).isEmpty();
    }

    private List<String> itemNumbers(JsonNode page) {
        return page.get("content").findValuesAsText("itemNo");
    }

    private ResponseEntity<JsonNode> itemTypePage(String itemType, int page, int size, String sort) {
        return rest.exchange(
                "/api/core/items?itemType={itemType}&page={page}&size={size}&sort={sort}",
                HttpMethod.GET,
                authEntity(loginAdmin(), null),
                JsonNode.class,
                itemType,
                page,
                size,
                sort);
    }

    private void assertInvalidInput(ResponseEntity<JsonNode> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_INPUT");
        assertThat(response.getBody().get("message").asText()).isNotBlank();
        assertThat(response.getBody().toString())
                .doesNotContain("Exception", "org.hibernate", "org.springframework");
    }
}
