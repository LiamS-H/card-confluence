import { ScryfallError, ScryfallList } from '@scryfall/api-types';
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
async function fetchUrl(url: string): Promise<ScryfallList.Cards | ScryfallError> {
    return axios
        .get<ScryfallList.Cards | ScryfallError>(url)
        .then((res) => {
            return res.data;
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                const ScryfallError: ScryfallError = {
                    object: 'error',
                    code: error.code ?? 'unknown',
                    details: error.message,
                    status: error.status ?? 400,
                };
                return ScryfallError;
            }
            console.log('test');
            throw Error('non axios request error');
        });
}
async function fetchQuery(queryString: string): Promise<ScryfallList.Cards | ScryfallError> {
    if (queryString.replace(/[()]/g, '').trim() == '')
        return {
            object: 'error',
            code: '400',
            details: 'query must not be empty.',
            status: 400,
        };
    return axios
        .get<ScryfallList.Cards | ScryfallError>('https://api.scryfall.com/cards/search', {
            params: {
                q: queryString,
            },
        })
        .then((res) => {
            return res.data;
        })
        .catch((error) => {
            if (axios.isAxiosError(error)) {
                const ScryfallError: ScryfallError = {
                    object: 'error',
                    code: error.code ?? 'unknown',
                    details: error.message,
                    status: error.status ?? 400,
                };
                return ScryfallError;
            }
            console.log('test');
            throw Error('non axios request error');
        });
}

function useScryfallSearch(queryString: string) {
    const cardQuery = useInfiniteQuery<
        ScryfallList.Cards,
        ScryfallError,
        InfiniteData<ScryfallList.Cards, string>,
        [string, { queryString: string }],
        string | undefined
    >({
        queryKey: ['scryfallRequest', { queryString }],
        queryFn: async ({ pageParam }) => {
            if (pageParam == undefined) {
                throw Error('invalid page');
            }
            const res = await fetchUrl(pageParam);
            if (res.object == 'error') {
                throw Error(res.details);
            }
            return res;
        },
        getNextPageParam: (lastPage) => {
            if ('has_more' in lastPage && 'next_page' in lastPage) return lastPage.next_page;
        },
        initialPageParam:
            queryString == ''
                ? undefined
                : `https://api.scryfall.com/cards/search?q=${encodeURIComponent(queryString)}`,
    });
    return cardQuery;
}

export { useScryfallSearch };
