type CompositionMode = 'and' | 'or' | 'not';

interface IComposition<T> {
    id: string;
    name: string;
    type: 'composition';
    mode: CompositionMode;
    components: (T | IComposition<T>)[];
}

export type { IComposition, CompositionMode };
