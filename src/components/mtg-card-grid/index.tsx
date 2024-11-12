import { ScryfallCard } from '@scryfall/api-types';
import MTGCard from '../mtg-card';
import { useMemo, type ReactNode } from 'react';
import { Box } from '@mui/material';

function RowContainer(props: { children: ReactNode }) {
    return (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                height: '100px',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    display: 'flex',
                    '@keyframes scroll': {
                        '0%': {
                            transform: 'translateX(0)',
                        },
                        '100%': {
                            transform: 'translateX(-50%)',
                        },
                    },
                    animation: 'scroll 40s linear infinite',
                    '&:hover': {
                        animationPlayState: 'paused',
                        transition: 'all 0.5s ease-in-out',
                    },
                    // Double the content for seamless scrolling
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '100%',
                        width: '100%',
                        height: '100%',
                    },
                }}
            >
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {props.children}
                    {/* Duplicate cards for seamless loop */}
                    {props.children}
                </Box>
            </Box>
        </Box>
    );
}

function MTGCardGrid(props: { cards: ScryfallCard.Any[] }) {
    // Split cards into three separate lists
    const [topRowCards, middleRowCards, bottomRowCards] = useMemo(() => {
        const total = props.cards.length;
        const perRow = Math.ceil(total / 3);

        return [
            props.cards.slice(0, perRow),
            props.cards.slice(perRow, perRow * 2),
            props.cards.slice(perRow * 2, total),
        ];
    }, [props.cards]);

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}
        >
            {/* Top Row - Regular Speed */}
            <RowContainer>
                {topRowCards.map((card, index) => (
                    <Box key={`top-${index}`} sx={{ flexShrink: 0 }}>
                        <MTGCard card={card} size='sm' />
                    </Box>
                ))}
            </RowContainer>

            {/* Middle Row - Reverse Direction */}
            <Box
                sx={{
                    '& > div > div': {
                        animation: 'scroll 35s linear infinite reverse',
                        '&:hover': {
                            animationPlayState: 'paused',
                            transition: 'all 0.5s ease-in-out',
                        },
                    },
                }}
            >
                <RowContainer>
                    {middleRowCards.map((card, index) => (
                        <Box key={`middle-${index}`} sx={{ flexShrink: 0 }}>
                            <MTGCard card={card} size='sm' />
                        </Box>
                    ))}
                </RowContainer>
            </Box>

            {/* Bottom Row - Slower Speed */}
            <Box
                sx={{
                    '& > div > div': {
                        animation: 'scroll 45s linear infinite',
                        '&:hover': {
                            animationPlayState: 'paused',
                            transition: 'all 0.5s ease-in-out',
                        },
                    },
                }}
            >
                <RowContainer>
                    {bottomRowCards.map((card, index) => (
                        <Box key={`bottom-${index}`} sx={{ flexShrink: 0 }}>
                            <MTGCard card={card} size='sm' />
                        </Box>
                    ))}
                </RowContainer>
            </Box>
        </Box>
    );
}

export default MTGCardGrid;
