import { IComposition } from './composition';
import { IFilter } from './filter';
import { ITrigger } from './trigger';

interface ISearch {
    domain: IComposition<IFilter>;
    filters: IComposition<IFilter>;
    triggers: IComposition<ITrigger>;
}

export type { ISearch };
