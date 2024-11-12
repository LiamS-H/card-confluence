import { createContext, useContext } from 'react';
import { IFilter } from '../types/interfaces/search/filter';
import { filterToString } from '../types/reducers/search';

const InvalidTagscontext = createContext<Record<string, string> | null>(null);

export const InvalidTagsProvider = InvalidTagscontext.Provider;

export function useTagMessage(filter: IFilter): string | null {
    const invalid_tags = useContext(InvalidTagscontext);
    if (invalid_tags == null) throw Error('invalid tags context must be used within provider.');
    const filterString = filterToString(filter);
    const message = invalid_tags[filterString];
    if (message) {
        return message;
    }
    return null;
}
