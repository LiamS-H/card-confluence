import { FixedSizeGrid as Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useScryfallSearch } from '../../hooks/scryfall/search';
import MTGCard from '../mtg-card';
import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';

export default function ScryfallInfiniteList(props: { queryString: string; columnCount: number }) {
    const searchQuery = useScryfallSearch(props.queryString);

    // Inside your component:
    const gridRef = useRef<HTMLDivElement>(null);

    // Flatten pages to get the list of cards
    const cards = searchQuery.data?.pages.map((page) => page.data).flat() || [];

    // Determine if an item is loaded by checking if it exists in the cards array
    const isItemLoaded = (index: number) => index < cards.length;

    // Load more items when reaching the end of the current list
    async function loadMoreItems(startIndex: number, stopIndex: number) {
        if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
            console.log('fetching next page');
            await searchQuery.fetchNextPage();
        }
        return;
    }

    // Render each card in the grid
    const Cell = ({
        columnIndex,
        rowIndex,
        style,
    }: {
        columnIndex: number;
        rowIndex: number;
        style: React.CSSProperties;
    }) => {
        const index = rowIndex * props.columnCount + columnIndex;
        const card = cards[index] ?? null;
        const id = index;
        return (
            <div style={{ ...style, scrollSnapAlign: 'start' }}>
                {<MTGCard key={id} card={card} />}
            </div>
        );
    };

    return (
        <Box className='outerbox' sx={{}}>
            <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={cards.length + (searchQuery.hasNextPage ? props.columnCount : 0)} // Adding extra row if there's more to load
                loadMoreItems={loadMoreItems}
            >
                {({ onItemsRendered, ref }) => (
                    <Grid
                        style={{
                            overflow: 'auto',
                            // overflow: 'hidden',
                            height: '100vh',
                            width: '100%',
                            scrollSnapType: 'y mandatory',
                            scrollBehavior: 'smooth',
                        }}
                        columnCount={props.columnCount}
                        columnWidth={200} // Adjust based on MTGCard width
                        height={window.innerHeight} // Full screen height
                        rowCount={Math.ceil(cards.length / props.columnCount)}
                        rowHeight={300} // Adjust based on MTGCard height
                        width={200 * props.columnCount + 20} // Full screen width
                        outerElementType='div' // Use div for global scroll
                        onItemsRendered={({
                            overscanRowStopIndex,
                            overscanRowStartIndex,
                            visibleRowStartIndex,
                            visibleRowStopIndex,
                        }) =>
                            onItemsRendered({
                                overscanStopIndex: overscanRowStopIndex * props.columnCount,
                                overscanStartIndex: overscanRowStartIndex * props.columnCount,
                                visibleStartIndex: visibleRowStartIndex * props.columnCount,
                                visibleStopIndex: visibleRowStopIndex * props.columnCount,
                            })
                        }
                        ref={ref}
                    >
                        {Cell}
                    </Grid>
                )}
            </InfiniteLoader>
        </Box>
    );
}
