package com.example.chat;

import com.example.chat.conversation.service.ConversationService;
import com.example.chat.message.dto.SendMessageRequest;
import com.example.chat.message.service.MessageService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ConversationFlowTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    MessageService messageService;

    @Autowired
    ConversationService conversationService;

    // The test database isn't reset between runs, so use fresh usernames every time.
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String alice = "c" + suffix + "_a";
    private final String bob = "c" + suffix + "_b";
    private final String carol = "c" + suffix + "_c";

    @Test
    void everyConversationIsListedHoweverBusyTheOthersAre() throws Exception {
        for (String username : new String[]{alice, bob, carol}) {
            register(username);
        }
        messageService.save(alice, new SendMessageRequest(carol, null, "hi carol"));
        // more than the 500 most recent messages the conversation list used to be built from
        for (int i = 0; i <= 500; i++) {
            messageService.save(bob, new SendMessageRequest(alice, null, "msg " + i));
        }
        String aliceToken = login(alice);

        mvc.perform(get("/api/messages/conversations").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].type").value("direct"))
                .andExpect(jsonPath("$[0].username").value(bob))
                .andExpect(jsonPath("$[0].lastMessage").value("msg 500"))
                .andExpect(jsonPath("$[0].lastSender").value(bob))
                .andExpect(jsonPath("$[1].username").value(carol))
                .andExpect(jsonPath("$[1].lastMessage").value("hi carol"))
                .andExpect(jsonPath("$[1].lastSender").value(alice));

        // history is paged within the conversation, newest first, and keeps the receiver
        mvc.perform(get("/api/messages/" + bob).param("size", "2").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].content").value("msg 500"))
                .andExpect(jsonPath("$[0].receiver").value(alice))
                .andExpect(jsonPath("$[0].groupId").doesNotExist())
                .andExpect(jsonPath("$[1].content").value("msg 499"));
    }

    @Test
    void oneToOneConversationsAreNotGroups() throws Exception {
        for (String username : new String[]{alice, bob, carol}) {
            register(username);
        }
        messageService.save(alice, new SendMessageRequest(bob, null, "hi"));
        messageService.save(bob, new SendMessageRequest(alice, null, "hey")); // same conversation, whoever writes
        long id = conversationService.findDirect(alice, bob).orElseThrow().getId();
        assertThat(conversationService.findDirect(bob, alice).orElseThrow().getId()).isEqualTo(id);
        assertThat(messageService.conversations(bob))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.username()).isEqualTo(alice);
                    assertThat(c.lastMessage()).isEqualTo("hey");
                });

        // its own members can't use it through the group endpoints: no adding members to a one-to-one chat
        String aliceToken = login(alice);
        mvc.perform(post("/api/groups/" + id + "/members").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usernames\":[\"" + carol + "\"]}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/groups/" + id).header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/groups/" + id + "/messages").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isForbidden());
        assertThatThrownBy(() -> messageService.save(alice, new SendMessageRequest(null, id, "sneaky")))
                .hasMessageContaining("not a member");

        assertThat(messageService.conversations(carol)).isEmpty();
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
