import { FixedSizeGrid as Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useScryfallSearch } from '../../hooks/scryfall/search';
import MTGCard from '../mtg-card';
import { Box } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScryfallCard } from '@scryfall/api-types';

const CARDS_PER_PAGE = 175;
const CARD_WIDTH = 200;
const SCROLL_BAR_WIDTH = 15;

export default function ScryfallInfiniteList(props: {
    searchQuery: ReturnType<typeof useScryfallSearch>;
}) {
    const totalItems = props.searchQuery.totalCards ?? 0;
    // const [snapEnabled, setSnapEnabled] = useState(true);
    const [width, setWidth] = useState<number>(0);
    const resizeRef = useRef<HTMLDivElement | null>(null);
    const columnCount: number = width ? Math.floor((width - SCROLL_BAR_WIDTH) / CARD_WIDTH) : 4;
    const columnWidth =
        CARD_WIDTH + (width - columnCount * CARD_WIDTH - SCROLL_BAR_WIDTH) / (columnCount - 1);
    const rowCount = Math.ceil(totalItems / columnCount);

    useEffect(() => {
        function handleResize() {
            if (resizeRef.current) setWidth(resizeRef.current.getBoundingClientRect().width);
        }
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const cards = useMemo(() => {
        const cards = Array<ScryfallCard.Any | null>(totalItems);
        cards.fill(null);
        // return searchQuery.data?.pages.map((page) => page.data).flat() || [];
        props.searchQuery.data?.pages.forEach((page) => {
            page.data.forEach((card, cardIndex) => {
                const index = page.page * CARDS_PER_PAGE + cardIndex;
                cards[index] = card;
            });
        });

        return cards;
    }, [props.searchQuery.data?.pages]);

    const isItemLoaded = (index: number) => {
        return cards[index] != null;
    };

    // Optimize loading strategy to load fewer pages at once
    async function loadMoreItems(startIndex: number) {
        // async function loadMoreItems(startIndex: number, stopIndex:number) {
        // Only load the immediate next page needed
        const targetPage = Math.floor(startIndex / CARDS_PER_PAGE);

        // if (!searchQuery.data?.pages.some((p) => p.next_page?.includes(`page=${targetPage}`))) {
        await props.searchQuery.getPage(targetPage);
        // }
    }

    const Cell = ({
        columnIndex,
        rowIndex,
        style,
    }: {
        columnIndex: number;
        rowIndex: number;
        style: React.CSSProperties;
    }) => {
        const index = rowIndex * columnCount + columnIndex;
        const card = cards[index];
        if (card === undefined) {
            return null;
        }
        return (
            <div
                style={{
                    ...style,
                    left: columnIndex * columnWidth,
                    scrollSnapAlign: 'start',
                }}
            >
                {<MTGCard key={index} card={card} />}
            </div>
        );
    };

    return (
        <Box
            // onMouseDown={() => setSnapEnabled(false)}
            // onMouseUp={() => setSnapEnabled(true)}
            ref={resizeRef}
        >
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
                            display: 'flex',
                            flexFlow: 'row wrap',
                            justifyContent: 'space-between',
                        }}
                        columnCount={columnCount}
                        columnWidth={CARD_WIDTH}
                        height={window.innerHeight}
                        rowCount={rowCount}
                        rowHeight={300}
                        width={CARD_WIDTH * columnCount + 20}
                        overscanRowCount={2}
                        onItemsRendered={({
                            overscanRowStopIndex,
                            overscanRowStartIndex,
                            visibleRowStartIndex,
                            visibleRowStopIndex,
                        }) =>
                            onItemsRendered({
                                overscanStopIndex: overscanRowStopIndex * columnCount,
                                overscanStartIndex: overscanRowStartIndex * columnCount,
                                visibleStartIndex: visibleRowStartIndex * columnCount,
                                visibleStopIndex: visibleRowStopIndex * columnCount,
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
