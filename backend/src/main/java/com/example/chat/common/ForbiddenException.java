package com.example.chat.common;

/**
 * The authenticated user is not allowed to access the requested resource (-> 403).
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
