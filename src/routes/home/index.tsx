import { Box, Container } from '@mui/material';
import Composition from '../../components/filter/composition';
import { useScryfallSymbols } from '../../hooks/scryfall/symbols';
import { useSearch } from '../../hooks/search';
import { IComposition } from '../../types/interfaces/search/composition';
import { IFilter } from '../../types/interfaces/search/filter';
import ScryfallInfiniteList from '../../components/scryfall-infinite-list';
import SortSelectors from '../../components/sort-selector';
import { isDirection, ISearch, isOrder } from '../../types/interfaces/search/search';

export default function Home() {
    const { search, setSearch, searchString } = useSearch();
    useScryfallSymbols();

    // const { isPending, error, data, isFetching } = useScryfallSearch(searchString);
    return (
        <Container>
            <Box color='gray'>
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
                <Box height='1vh'>
                    <SortSelectors
                        order={search.order}
                        direction={search.direction}
                        onOrderChange={(ord) =>
                            setSearch((search: ISearch): ISearch => {
                                return isOrder(ord) ? { ...search, order: ord } : search;
                            })
                        }
                        onDirectionChange={(dir) =>
                            setSearch((search: ISearch): ISearch => {
                                console.log('setting dir:', dir);
                                return isDirection(dir) ? { ...search, direction: dir } : search;
                            })
                        }
                    />
                    {/* <MTGCardList cards={searchQuery.data?.pages.map((page) => page.data).flat()} /> */}
                    {/* <button onClick={() => searchQuery.fetchNextPage()}>Load More</button> */}
                    <ScryfallInfiniteList queryString={searchString} columnCount={4} />
                </Box>
            </Box>
        </Container>
    );
}
