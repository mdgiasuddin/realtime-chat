package com.example.chat.exception;

/**
 * Missing, expired or revoked credentials (-> 401); the client has to log in again.
 */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
