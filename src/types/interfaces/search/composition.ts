interface IComposition<T> {
    name: string;
    type: 'composition';
    mode: 'and' | 'or' | 'not';
    components: (T | IComposition<T>)[];
}

export type { IComposition };
