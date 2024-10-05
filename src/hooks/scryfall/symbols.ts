import { ScryfallList } from '@scryfall/api-types';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { IScrysymbolMap } from 'react-scrycards';

function useScryfallSymbols() {
    const cardQuery = useQuery({
        queryKey: ['scryfallSymbols'],
        queryFn: () =>
            axios
                .get<ScryfallList.CardSymbols>('https://api.scryfall.com/symbology')
                .then((res) => {
                    const symbols: IScrysymbolMap = {};
                    res.data.data.forEach((symbol) => {
                        if (!symbol.svg_uri) return;
                        symbols[symbol.symbol] = symbol.svg_uri;
                    });
                    return symbols;
                }),
    });
    return cardQuery;
}

export { useScryfallSymbols };
