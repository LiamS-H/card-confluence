import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { IScryfallSymbolResult, ISymbolMap } from '../../types/interfaces/scryfall/symbol';

function useScryfallSymbols() {
    const cardQuery = useQuery({
        queryKey: ['scryfallSymbols'],
        queryFn: () =>
            axios.get<IScryfallSymbolResult>('https://api.scryfall.com/symbology').then((res) => {
                const symbols: ISymbolMap = {};
                res.data.data.forEach((symbol) => {
                    symbols[symbol.symbol] = {
                        uri: symbol.svg_uri,
                        description: symbol.english,
                    };
                });
                return symbols;
            }),
    });
    return cardQuery;
}

export { useScryfallSymbols };
