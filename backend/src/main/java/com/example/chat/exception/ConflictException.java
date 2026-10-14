package com.example.chat.exception;

/**
 * The request conflicts with the current state of the resource (-> 409).
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
