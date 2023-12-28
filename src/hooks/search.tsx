import { useEffect, useState } from 'react';
import { ISearch } from '../types/interfaces/search/search';
import { genQueryString } from '../types/reducers/search';

function useSearch() {
    const [searchString, setSearchString] = useState<string>('');
    const [search, setSearch] = useState<ISearch>({
        domain: {
            name: 'domain',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        filters: {
            name: 'filters',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        triggers: {
            name: 'triggers',
            type: 'composition',
            mode: 'and',
            components: [],
        },
    });
    useEffect(() => {
        setSearchString(genQueryString(search));
    }, [search]);

    return { setSearch, search, searchString };
}

export { useSearch };
