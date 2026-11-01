package com.example.chat;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// No grace period, so reusing a rotated token is caught without waiting.
@SpringBootTest(properties = "app.auth.refresh-token.reuse-grace=0s")
@AutoConfigureMockMvc
class RefreshTokenFlowTest {

    private static final String COOKIE = "refresh_token";

    @Autowired
    MockMvc mvc;

    // The test database isn't reset between runs, so use fresh usernames every time.
    private final String alice = "r" + UUID.randomUUID().toString().substring(0, 8) + "_a";

    @Test
    void loginRefreshRotateAndLogout() throws Exception {
        register(alice);

        // the access token's lifetime is in the body, the refresh token only in an HttpOnly cookie
        MockHttpServletResponse login = login(null)
                .andExpect(jsonPath("$.expiresIn").value(1800))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn().getResponse();
        Cookie first = login.getCookie(COOKIE);
        assertThat(first).isNotNull();
        assertThat(first.isHttpOnly()).isTrue();
        assertThat(first.getPath()).isEqualTo("/api/auth");

        // refresh: a working access token, and the refresh token is rotated
        MockHttpServletResponse refreshed = refresh(first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(alice))
                .andExpect(jsonPath("$.expiresIn").value(1800))
                .andReturn().getResponse();
        Cookie second = refreshed.getCookie(COOKIE);
        assertThat(second).isNotNull();
        assertThat(second.getValue()).isNotEqualTo(first.getValue());
        String token = JsonPath.read(refreshed.getContentAsString(), "$.token");
        mvc.perform(get("/api/users/search").param("q", "zz").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // the used token again looks like theft: refused, and the whole session is revoked
        refresh(first).andExpect(status().isUnauthorized());
        refresh(second).andExpect(status().isUnauthorized());
        // no cookie at all
        mvc.perform(post("/api/auth/refresh")).andExpect(status().isUnauthorized());

        // logging in again in the same browser ends the session that was there before
        Cookie previous = login(null).andReturn().getResponse().getCookie(COOKIE);
        Cookie current = login(previous).andReturn().getResponse().getCookie(COOKIE);
        refresh(previous).andExpect(status().isUnauthorized());
        Cookie rotated = refresh(current).andExpect(status().isOk()).andReturn().getResponse().getCookie(COOKIE);

        // logout revokes the token and drops the cookie
        Cookie cleared = mvc.perform(post("/api/auth/logout").cookie(rotated))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getCookie(COOKIE);
        assertThat(cleared).isNotNull();
        assertThat(cleared.getMaxAge()).isZero();
        refresh(rotated).andExpect(status().isUnauthorized());
    }

    private ResultActions refresh(Cookie cookie) throws Exception {
        return mvc.perform(post("/api/auth/refresh").cookie(cookie));
    }

    /**
     * @param cookie the refresh-token cookie the browser already holds, or null
     */
    private ResultActions login(Cookie cookie) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + alice + "\",\"password\":\"secret1\"}");
        if (cookie != null) {
            request.cookie(cookie);
        }
        return mvc.perform(request).andExpect(status().isOk());
    }

    private void register(String username) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + username + "\",\"username\":\"" + username
                                + "\",\"password\":\"secret1\",\"email\":\"" + username + "@example.com\"}"))
                .andExpect(status().isCreated());
    }
}
