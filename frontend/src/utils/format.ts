import type {IsoDateString} from '../types/api';

/** "14:05"-style local time. */
export const formatTime = (iso: IsoDateString): string =>
    new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
