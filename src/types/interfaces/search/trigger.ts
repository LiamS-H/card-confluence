interface ITrigger {
    type: 'trigger';
    source: string;
    event: string;
    action: string;
    destination: string;
}

export type { ITrigger };
