import { Box, Container } from '@mui/material';
import Composition from '../../components/filter/composition';
import { useScryfallSearch } from '../../hooks/scryfall/search';
import { useScryfallSymbols } from '../../hooks/scryfall/symbols';
import { useSearch } from '../../hooks/search';
import { IComposition } from '../../types/interfaces/search/composition';
import { IFilter } from '../../types/interfaces/search/filter';
import MTGCardList from '../../components/mtg-card-list';
import ScryfallInfiniteList from '../../components/scryfall-infinite-list';

export default function Home() {
    const { search, setSearch, searchString } = useSearch();
    useScryfallSymbols();

    // const { isPending, error, data, isFetching } = useScryfallSearch(searchString);
    const searchQuery = useScryfallSearch(searchString);
    return (
        <Container>
            <Box>
                <p>{searchString}</p>
                <Composition
                    comp={search.domain}
                    root
                    setComp={(comp: IComposition<IFilter> | null) => {
                        if (comp == null) return;
                        setSearch((searchObj) => ({ ...searchObj, domain: comp }));
                    }}
                />
                <Composition
                    comp={search.filters}
                    root
                    setComp={(comp: IComposition<IFilter> | null) => {
                        if (comp == null) return;
                        setSearch((searchObj) => ({ ...searchObj, filters: comp }));
                    }}
                />
            </Box>
            {/* <MTGCardList cards={searchQuery.data?.pages.map((page) => page.data).flat()} /> */}
            {/* <button onClick={() => searchQuery.fetchNextPage()}>Load More</button> */}
            <ScryfallInfiniteList queryString={searchString} columnCount={4} />
        </Container>
    );
}
