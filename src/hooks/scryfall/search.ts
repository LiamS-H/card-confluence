import { ScryfallError, ScryfallList } from '@scryfall/api-types';
import { InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
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
        if (!axios.isAxiosError(error)) {
            throw new Error('non axios request error');
        }
        if (error.response && error.response.data.object == 'error') {
            const scry_error: ScryfallError = error.response.data;
            return {
                object: 'error',
                code: scry_error.code,
                details: scry_error.details,
                status: scry_error.status,
            };
        }
        return {
            object: 'error',
            code: error.code ?? 'unknown',
            details: error.message,
            status: error.status ?? 400,
        };
    }
}

export function useScryfallNewest() {
    const cardQuery = useQuery({
        queryKey: ['scryfall', 'newest'],
        queryFn: async () => {
            const res = await fetchQuery('order:release direction:desc is:firstprinting', 1);
            if (res.object === 'error') {
                throw new Error(res.details);
            }
            return res.data;
        },
    });
    return cardQuery;
}

export function useScryfallSearch(queryString: string) {
    const [message, setMessage] = useState<string[] | null>(null);
    const [totalCards, setTotalCards] = useState<number | null>(null);
    const targetPageRef = useRef<number | null>(null);
    const loadingPageRef = useRef<number | null>(null);

    useEffect(() => {
        setTotalCards(0);
    }, [queryString]);

    const cardQuery = useInfiniteQuery<
        ScryfallList.Cards & { page: number },
        ScryfallError,
        InfiniteData<ScryfallList.Cards & { page: number }, number>,
        [string, { queryString: string }],
        number
    >({
        queryKey: ['scryfallRequest', { queryString }],
        queryFn: async ({ pageParam }) => {
            const pageToFetch = targetPageRef.current ?? pageParam;
            // targetPageRef.current = null;

            // Prevent duplicate page loads
            // if (loadingPageRef.current === pageToFetch) {
            //     console.log('duplicate load discarded', pageToFetch);
            //     throw new Error('Page already loading');
            // }

            loadingPageRef.current = pageToFetch;
            try {
                const res = await fetchQuery(queryString, pageToFetch);
                // if (res.warnings) {
                //     setMessage(res.warnings);
                // }
                setMessage(res.warnings || ['']);
                if (res.object === 'error') {
                    setMessage([res.details]);
                    return {
                        data: [],
                        has_more: false,
                        object: 'list',
                        page: 1,
                    };
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
        targetPageRef.current = page;
        await cardQuery.fetchNextPage();
    };

    return { ...cardQuery, totalCards, getPage, message };
}
