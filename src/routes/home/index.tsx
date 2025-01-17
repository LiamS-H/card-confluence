import { Box, Container, LinearProgress } from '@mui/material';
import { useScryfallSymbols } from '../../hooks/scryfall/symbols';
import { useSearch } from '../../hooks/search';
import ScryfallInfiniteList from '../../components/scryfall-infinite-list';
import SortSelectors from '../../components/sort-selector';
import { isDirection, ISearch, isOrder, isPrinting } from '../../types/interfaces/search/search';
import { useScryfallSearch } from '../../hooks/scryfall/search';
import FilterBoard from '../../components/filter-board';

export default function Home() {
    const { search, setSearch, searchString } = useSearch();
    const searchQuery = useScryfallSearch(searchString);
    useScryfallSymbols();

    return (
        <>
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    height: 2,
                    width: `100%`,
                }}
            >
                {searchQuery.isLoading ? <LinearProgress /> : null}
            </Box>
            <Container>
                <Box color='gray'>
                    <FilterBoard
                        search={search}
                        searchString={searchString}
                        setSearch={setSearch}
                        message={searchQuery.message}
                    />
                    <Box
                        sx={{
                            height: '1vh',
                            minWidth: '430px',
                        }}
                    >
                        <SortSelectors
                            order={search.order}
                            direction={search.direction}
                            printing={search.printing}
                            onOrderChange={(ord) =>
                                setSearch((search: ISearch): ISearch => {
                                    return isOrder(ord) ? { ...search, order: ord } : search;
                                })
                            }
                            onDirectionChange={(dir) =>
                                setSearch((search: ISearch): ISearch => {
                                    return isDirection(dir)
                                        ? { ...search, direction: dir }
                                        : search;
                                })
                            }
                            onPrintingChange={(print) =>
                                setSearch((search: ISearch): ISearch => {
                                    return isPrinting(print)
                                        ? { ...search, printing: print }
                                        : search;
                                })
                            }
                        />
                        {/* <MTGCardList cards={searchQuery.data?.pages.map((page) => page.data).flat()} /> */}
                        {/* <button onClick={() => searchQuery.fetchNextPage()}>Load More</button> */}
                        <ScryfallInfiniteList searchQuery={searchQuery} />
                    </Box>
                </Box>
            </Container>
        </>
    );
}
