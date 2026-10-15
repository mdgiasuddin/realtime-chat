package com.example.chat;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class KeyFlowTest {

    @Autowired
    MockMvc mvc;

    // The test database isn't reset between runs, so use fresh usernames every time.
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String alice = "k" + suffix + "_a";
    private final String bob = "k" + suffix + "_b";

    @Test
    void storeRestoreRotateAndShareKeys() throws Exception {
        register(alice);
        register(bob);
        String aliceToken = login(alice);
        String bobToken = login(bob);

        // nothing registered yet
        mvc.perform(get("/api/users/me/keys").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicKey").isEmpty())
                .andExpect(jsonPath("$.encryptedPrivateKey").isEmpty());
        mvc.perform(get("/api/users/" + alice + "/public-key").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isNotFound());

        // wrong login password -> 403, nothing stored
        putKeys(aliceToken, "pk1", "blob1", false, "wrong-password").andExpect(status().isForbidden());
        mvc.perform(get("/api/users/me/keys").header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.publicKey").isEmpty());

        putKeys(aliceToken, "pk1", "blob1", false).andExpect(status().isOk());

        mvc.perform(get("/api/users/me/keys").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicKey").value("pk1"))
                .andExpect(jsonPath("$.encryptedPrivateKey").value("blob1"));

        // same public key, new backup (passphrase change) -> allowed without rotate
        putKeys(aliceToken, "pk1", "blob2", false).andExpect(status().isOk());

        // different public key without rotate -> 409, with rotate -> ok
        putKeys(aliceToken, "pk2", "blob3", false).andExpect(status().isConflict());
        putKeys(aliceToken, "pk2", "blob3", true, "wrong-password").andExpect(status().isForbidden());
        putKeys(aliceToken, "pk2", "blob3", true).andExpect(status().isOk());

        // others see only the public key (case-insensitive lookup)
        mvc.perform(get("/api/users/" + alice.toUpperCase() + "/public-key")
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(alice))
                .andExpect(jsonPath("$.publicKey").value("pk2"))
                .andExpect(jsonPath("$.encryptedPrivateKey").doesNotExist());

        // batch lookup: users without a key (bob) and unknown users are left out
        mvc.perform(get("/api/users/public-keys").param("usernames", alice.toUpperCase() + "," + bob + ",nobody_" + suffix)
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].username").value(alice))
                .andExpect(jsonPath("$[0].publicKey").value("pk2"));

        // blank fields -> 400
        putKeys(aliceToken, "", "blob", false).andExpect(status().isBadRequest());
    }

    private ResultActions putKeys(String token, String publicKey, String blob, boolean rotate) throws Exception {
        return putKeys(token, publicKey, blob, rotate, "secret1");
    }

    private ResultActions putKeys(
            String token, String publicKey, String blob, boolean rotate, String password) throws Exception {
        return mvc.perform(put("/api/users/me/keys").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"publicKey\":\"" + publicKey + "\",\"encryptedPrivateKey\":\"" + blob
                        + "\",\"rotate\":" + rotate + ",\"password\":\"" + password + "\"}"));
    }

    private void register(String username) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + username + "\",\"username\":\"" + username
                                + "\",\"password\":\"secret1\",\"email\":\"" + username + "@example.com\"}"))
                .andExpect(status().isCreated());
    }

    private String login(String username) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"secret1\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }
}
