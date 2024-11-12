import { useEffect, useState } from 'react';
import { ISearch } from '../types/interfaces/search/search';
import { genQueryString } from '../types/reducers/search';

function useSearch() {
    const [searchString, setSearchString] = useState<string>('');
    const [search, setSearch] = useState<ISearch>({
        domain: {
            id: 'domain',
            name: 'Domain',
            type: 'composition',
            mode: 'and',
            components: [
                {
                    type: 'filter',
                    filter: 'game',
                    operator: ':',
                    value: 'paper',
                },
                {
                    type: 'filter',
                    filter: 'legal',
                    operator: ':',
                    value: 'commander',
                },
            ],
        },
        filters: {
            id: 'filters',
            name: 'Filters',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        triggers: {
            id: 'triggers',
            name: 'Triggers',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        order: 'cmc',
        direction: 'auto',
        printing: 'auto',
    });
    useEffect(() => {
        setSearchString(genQueryString(search));
    }, [search]);

    return { setSearch, search, searchString };
}

export { useSearch };
