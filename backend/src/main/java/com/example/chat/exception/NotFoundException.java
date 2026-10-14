package com.example.chat.exception;

/**
 * The requested resource does not exist (-> 404).
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
