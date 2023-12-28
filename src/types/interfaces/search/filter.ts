type Operator = '<' | '<=' | '>' | '>=' | '=' | ':' | string;

type Filter = '' | string;

interface IFilter {
    type: 'filter';
    filter: Filter;
    operator: Operator;
    value: string;
}

export type { IFilter };
