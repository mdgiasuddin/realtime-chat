import type {IsoDateString} from '../types/api';

/** "14:05"-style local time. */
export const formatTime = (iso: IsoDateString): string =>
    new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

/** Full local date and time, e.g. for tooltips. */
export const formatDateTime = (iso: IsoDateString): string =>
    new Date(iso).toLocaleString([], {dateStyle: 'full', timeStyle: 'short'});

/** Do both timestamps fall on the same local calendar day? */
export const isSameDay = (a: IsoDateString, b: IsoDateString): boolean =>
    new Date(a).toDateString() === new Date(b).toDateString();

/** Day separator label: "Today", "Yesterday", or e.g. "Mon, 28 Oct 2026". */
export function formatDay(iso: IsoDateString): string {
    const date = new Date(iso);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === new Date().toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'});
}
