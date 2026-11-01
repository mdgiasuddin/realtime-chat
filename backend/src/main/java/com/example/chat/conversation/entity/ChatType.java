package com.example.chat.conversation.entity;

/**
 * Members can only be added to (and roles only matter in) GROUP conversations; a ONE_TO_ONE conversation always has
 * exactly its two participants.
 */
public enum ChatType {ONE_TO_ONE, GROUP}
