package com.example.chat;

import com.example.chat.message.MessageService;
import com.example.chat.message.SendMessageRequest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class GroupFlowTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    MessageService messageService;

    // The test database isn't reset between runs, so use fresh usernames every time. They're built
    // from hex digits only, so they never match the user searches other tests run (e.g. "bo").
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String alice = "g" + suffix + "_a";
    private final String bob = "g" + suffix + "_b";
    private final String carol = "g" + suffix + "_c";
    private final String dave = "g" + suffix + "_d";

    @Test
    void createAddLeaveAndAccessControl() throws Exception {
        for (String username : new String[]{alice, bob, carol, dave}) {
            register(username);
        }
        String aliceToken = login(alice);
        String bobToken = login(bob);
        String daveToken = login(dave);

        // alice creates a group with bob and carol (the creator is added automatically)
        String body = mvc.perform(post("/api/groups").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Team\",\"members\":[\"" + bob + "\",\"" + carol.toUpperCase() + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Team"))
                .andExpect(jsonPath("$.createdBy").value(alice))
                .andExpect(jsonPath("$.members.length()").value(3))
                .andReturn().getResponse().getContentAsString();
        int groupId = JsonPath.read(body, "$.id");

        // unknown member -> 400
        mvc.perform(post("/api/groups").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"members\":[\"nobody_" + suffix + "\"]}"))
                .andExpect(status().isBadRequest());

        // non-member -> 403
        mvc.perform(get("/api/groups/" + groupId).header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/groups/" + groupId + "/messages").header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isForbidden());

        // a message is visible in history and in the conversation list
        messageService.save(alice, new SendMessageRequest(null, (long) groupId, "hello team"));
        mvc.perform(get("/api/groups/" + groupId + "/messages").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].content").value("hello team"))
                .andExpect(jsonPath("$[0].groupId").value(groupId))
                .andExpect(jsonPath("$[0].receiver").doesNotExist());
        mvc.perform(get("/api/messages/conversations").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("group"))
                .andExpect(jsonPath("$[0].groupId").value(groupId))
                .andExpect(jsonPath("$[0].lastSender").value(alice));

        // any member can add others
        mvc.perform(post("/api/groups/" + groupId + "/members").header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usernames\":[\"" + dave + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(4));
        mvc.perform(get("/api/groups/" + groupId + "/messages").header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isOk());

        // bob leaves and loses access
        mvc.perform(delete("/api/groups/" + groupId + "/members/me").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/groups/" + groupId).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
        assertThatThrownBy(() -> messageService.save(bob, new SendMessageRequest(null, (long) groupId, "hi")))
                .hasMessageContaining("not a member");
    }

    @Test
    void adminRoles() throws Exception {
        for (String username : new String[]{alice, bob, carol, dave}) {
            register(username);
        }
        String aliceToken = login(alice);
        String bobToken = login(bob);
        String carolToken = login(carol);

        String body = mvc.perform(post("/api/groups").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Team\",\"members\":[\"" + bob + "\",\"" + carol + "\",\"" + dave + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.admins", contains(alice)))
                .andReturn().getResponse().getContentAsString();
        int groupId = JsonPath.read(body, "$.id");
        String group = "/api/groups/" + groupId;

        // non-admins can't rename, delete, remove or promote
        mvc.perform(patch(group).header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Mine\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete(group).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
        mvc.perform(delete(group + "/members/" + carol).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
        mvc.perform(patch(group + "/members/" + bob).header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":true}"))
                .andExpect(status().isForbidden());

        // the admin renames, and the last admin can't be demoted
        mvc.perform(patch(group).header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"));
        mvc.perform(patch(group + "/members/" + alice).header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":false}"))
                .andExpect(status().isBadRequest());

        // a promoted admin can remove members; the removed member loses access
        mvc.perform(patch(group + "/members/" + bob).header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admins.length()").value(2));
        mvc.perform(delete(group + "/members/" + carol).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(3));
        mvc.perform(get(group).header("Authorization", "Bearer " + carolToken))
                .andExpect(status().isForbidden());

        // when the admins leave, the longest-standing member (dave) takes over
        mvc.perform(delete(group + "/members/me").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNoContent());
        mvc.perform(delete(group + "/members/me").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isNoContent());
        String daveToken = login(dave);
        mvc.perform(get(group).header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admins", contains(dave)));

        // the admin deletes the group
        mvc.perform(delete(group).header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isNoContent());
        mvc.perform(get(group).header("Authorization", "Bearer " + daveToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void messageMustTargetExactlyOneRecipientOrGroup() throws Exception {
        register(alice);
        register(bob);
        assertThatThrownBy(() -> messageService.save(alice, new SendMessageRequest(bob, 1L, "hi")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> messageService.save(alice, new SendMessageRequest(null, null, "hi")))
                .isInstanceOf(IllegalArgumentException.class);
        // direct messages still work and don't show up as group conversations
        assertThat(messageService.save(alice, new SendMessageRequest(bob, null, "hi")).receiver()).isEqualTo(bob);
        assertThat(messageService.conversations(alice))
                .singleElement()
                .satisfies(c -> assertThat(c.type()).isEqualTo("direct"));
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
