type Operator = '<' | '<=' | '>' | '>=' | '=' | ':';
const operators = ['<', '<=', '>', '>=', '=', ':'];

function isOperator(o: string): o is Operator {
    return operators.includes(o);
}

type Filter = '' | string;

interface IFilter {
    type: 'filter';
    filter: Filter;
    operator: Operator;
    value: string;
    error?: string;
}

export type { IFilter };
export { operators, isOperator };
