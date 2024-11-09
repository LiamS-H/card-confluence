import { ReactNode, useEffect, useRef, useState } from 'react';

export default function useWidth(text: string): { width: number; Listener: () => ReactNode } {
    const [width, setWidth] = useState(0);
    const listenerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!listenerRef.current) return;
        setWidth(listenerRef.current.offsetWidth);
    }, [text]);

    function Listener() {
        return (
            <span
                ref={listenerRef}
                style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }}
            >
                {text}
            </span>
        );
    }

    return { width, Listener };
}
