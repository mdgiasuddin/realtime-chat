import {useCallback, useEffect, useRef, useState} from 'react';

const TOAST_DURATION_MS = 3500;

/** A single auto-dismissing notification. `showToast` is stable across renders. */
export function useToast() {
    const [toast, setToast] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = useCallback((message: string) => {
        setToast(message);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {toast, showToast};
}
