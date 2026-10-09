import {type ReactNode, useEffect, useRef} from 'react';

interface ModalProps {
    title: string;
    /** Called on Escape too; the parent closes the modal by unmounting it. */
    onClose: () => void;
    children: ReactNode;
}

/** Native modal <dialog>, shown as soon as it mounts. */
export default function Modal({title, onClose, children}: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal(); // StrictMode runs this twice in dev
    }, []);

    return (
        <dialog ref={dialogRef} className="card" onClose={onClose}>
            <h1>{title}</h1>
            {children}
        </dialog>
    );
}
