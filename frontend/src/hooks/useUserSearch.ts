import {useEffect, useState} from 'react';
import type {ChatApi} from '../api/endpoints';
import type {UserSummary} from '../types/api';
import {getErrorMessage} from '../utils/errors';

const DEBOUNCE_MS = 300;

/** Debounced user search; in-flight requests are aborted when the query changes. */
export function useUserSearch(query: string, chatApi: ChatApi, onError: (message: string) => void): UserSummary[] {
    const [results, setResults] = useState<UserSummary[]>([]);
    const q = query.trim();

    useEffect(() => {
        if (!q) {
            setResults([]);
            return undefined;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setResults(await chatApi.searchUsers(q, controller.signal));
            } catch (err) {
                if (!controller.signal.aborted) onError(getErrorMessage(err));
            }
        }, DEBOUNCE_MS);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [q, chatApi, onError]);

    return results;
}
