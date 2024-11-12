import { IComposition } from './composition';
import { IFilter } from './filter';
import { ITrigger } from './trigger';

export const orders = ['cmc', 'release', 'number', 'price', 'edhrec', 'color', 'review'];
export function isOrder(str: string): str is ISearch['order'] {
    return orders.includes(str);
}
export const directions = ['asc', 'desc', 'auto'];
export function isDirection(str: string): str is ISearch['direction'] {
    return directions.includes(str);
}

export const printings = ['unique', 'newest', 'oldest', 'auto'];
export function isPrinting(str: string): str is ISearch['printing'] {
    return printings.includes(str);
}

interface ISearch {
    domain: IComposition<IFilter>;
    filters: IComposition<IFilter>;
    triggers: IComposition<ITrigger>;
    order: 'cmc' | 'release' | 'number' | 'price' | 'edhrec' | 'color' | 'review';
    direction: 'asc' | 'desc' | 'auto';
    printing: 'unique' | 'newest' | 'oldest' | 'auto';
}

export type { ISearch };
