/** Joins the truthy class names: cx('bubble', isMine && 'mine') => "bubble mine". */
export function cx(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}
