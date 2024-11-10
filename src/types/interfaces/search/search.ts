import { IComposition } from './composition';
import { IFilter } from './filter';
import { ITrigger } from './trigger';

export const orders = ['cmc', 'release', 'number', 'price', 'edhrec'];
export function isOrder(str: string): str is ISearch['order'] {
    return orders.includes(str);
}
export const directions = ['asc', 'desc', 'auto'];
export function isDirection(str: string): str is ISearch['direction'] {
    console.log(directions.includes(str) ? 'is dir:' + str : 'not dir:' + str);

    return directions.includes(str);
}

interface ISearch {
    domain: IComposition<IFilter>;
    filters: IComposition<IFilter>;
    triggers: IComposition<ITrigger>;
    order: 'cmc' | 'release' | 'number' | 'price' | 'edhrec';
    direction: 'asc' | 'desc' | 'auto';
}

export type { ISearch };
