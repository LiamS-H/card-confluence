import { FixedSizeGrid as Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useScryfallSearch } from '../../hooks/scryfall/search';
import MTGCard from '../mtg-card';
import { Box } from '@mui/material';
import { useMemo, useState } from 'react';
import { ScryfallCard } from '@scryfall/api-types';

const CARDS_PER_PAGE = 175;

export default function ScryfallInfiniteList(props: { queryString: string; columnCount: number }) {
    const searchQuery = useScryfallSearch(props.queryString);

    const totalItems = searchQuery.totalCards ?? 0;
    const rowCount = Math.ceil(totalItems / props.columnCount);
    const [snapEnabled, setSnapEnabled] = useState(true);

    const cards = useMemo(() => {
        const cards = Array<ScryfallCard.Any | null>(totalItems);
        cards.fill(null);
        // return searchQuery.data?.pages.map((page) => page.data).flat() || [];
        searchQuery.data?.pages.forEach((page) => {
            // console.log('updating data in page:', page.page);
            page.data.forEach((card, cardIndex) => {
                const index = page.page * CARDS_PER_PAGE + cardIndex;
                cards[index] = card;
            });
        });

        return cards;
    }, [searchQuery.data]);

    // Use actual total or estimate based on current data

    const isItemLoaded = (index: number) => {
        return cards[index] != null;
    };

    // Optimize loading strategy to load fewer pages at once
    const loadMoreItems = async (startIndex: number, stopIndex: number) => {
        // Only load the immediate next page needed
        const targetPage = Math.floor(startIndex / CARDS_PER_PAGE);
        console.log('requesting page', targetPage);

        // if (!searchQuery.data?.pages.some((p) => p.next_page?.includes(`page=${targetPage}`))) {
        await searchQuery.getPage(targetPage);
        // }
    };

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
        return (
            <div
                style={{
                    ...style,
                    scrollSnapAlign: 'start',
                }}
            >
                {<MTGCard key={index} card={card} />}
            </div>
        );
    };

    return (
        <Box onMouseDown={() => setSnapEnabled(false)} onMouseUp={() => setSnapEnabled(true)}>
            <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={totalItems}
                loadMoreItems={loadMoreItems}
                minimumBatchSize={CARDS_PER_PAGE}
            >
                {({ onItemsRendered, ref }) => (
                    <Grid
                        ref={ref}
                        style={{
                            height: '90vh',
                            width: '100%',
                            overflow: 'auto',
                            // scrollSnapType: snapEnabled ? 'y mandatory' : 'none',
                            scrollBehavior: 'auto',
                        }}
                        columnCount={props.columnCount}
                        columnWidth={200}
                        height={window.innerHeight}
                        rowCount={rowCount}
                        rowHeight={300}
                        width={200 * props.columnCount + 20}
                        overscanRowCount={2}
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
                    >
                        {Cell}
                    </Grid>
                )}
            </InfiniteLoader>
        </Box>
    );
}
