import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { IScryfallCardResult } from '../../types/interfaces/scryfall/cards';

async function queryFunction(queryString: string) {
    if (queryString.replace(/[()]/g, '').trim() == '') return [];
    return axios
        .get<IScryfallCardResult>('https://api.scryfall.com/cards/search', {
            params: {
                q: queryString,
            },
        })
        .then((res) => res.data.data);
}

function useScryfallSearch(queryString: string) {
    const cardQuery = useQuery({
        queryKey: ['scryfallRequest', { queryString: queryString }],
        queryFn: () => queryFunction(queryString),
    });
    return cardQuery;
}

export { useScryfallSearch };
