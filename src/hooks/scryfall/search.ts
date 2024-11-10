import { ScryfallError, ScryfallList } from '@scryfall/api-types';
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState } from 'react';

async function fetchQuery(
    queryString: string,
    page: number,
): Promise<ScryfallList.Cards | ScryfallError> {
    if (queryString.replace(/[()]/g, '').trim() === '') {
        return {
            object: 'error',
            code: '400',
            details: 'query must not be empty.',
            status: 400,
        };
    }

    try {
        const response = await axios.get<ScryfallList.Cards | ScryfallError>(
            'https://api.scryfall.com/cards/search',
            {
                params: {
                    q: queryString,
                    page: page + 1,
                },
            },
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            return {
                object: 'error',
                code: error.code ?? 'unknown',
                details: error.message,
                status: error.status ?? 400,
            };
        }
        throw new Error('non axios request error');
    }
}

export function useScryfallSearch(queryString: string) {
    const [totalCards, setTotalCards] = useState<number | null>(null);
    const targetPageRef = useRef<number | null>(null);
    const loadingPageRef = useRef<number | null>(null);

    const cardQuery = useInfiniteQuery<
        ScryfallList.Cards & { page: number },
        ScryfallError,
        InfiniteData<ScryfallList.Cards & { page: number }, number>,
        [string, { queryString: string }],
        number
    >({
        queryKey: ['scryfallRequest', { queryString }],
        queryFn: async ({ pageParam }) => {
            console.log('queryFn', pageParam, targetPageRef.current);
            const pageToFetch = targetPageRef.current ?? pageParam;
            targetPageRef.current = null;

            // Prevent duplicate page loads
            if (loadingPageRef.current === pageToFetch) {
                console.log('duplicate load discarded', pageToFetch);
                throw new Error('Page already loading');
            }

            loadingPageRef.current = pageToFetch;
            try {
                const res = await fetchQuery(queryString, pageToFetch);
                if (res.object === 'error') {
                    throw new Error(res.details);
                }
                if ('total_cards' in res && res.total_cards) {
                    setTotalCards(res.total_cards);
                }
                return { ...res, page: pageToFetch };
            } finally {
                loadingPageRef.current = null;
            }
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            if (!lastPage.has_more || !lastPage.next_page) {
                return undefined;
            }
            const match = lastPage.next_page.match(/[?&]page=(\d+)/);
            if (!match) return undefined;
            const pageNumber = parseInt(match[1]);
            return isNaN(pageNumber) ? undefined : pageNumber - 1;
        },
        enabled: queryString !== '',
    });

    const getPage = async (page: number) => {
        console.log('getting page');
        targetPageRef.current = page;
        await cardQuery.fetchNextPage();
    };

    return { ...cardQuery, totalCards, getPage };
}
