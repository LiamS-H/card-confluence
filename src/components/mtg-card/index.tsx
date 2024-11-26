import MTGTypography from '../mtg-typography';
import { isFlippable, Scrycard } from 'react-scrycards';
import { ScryfallCard } from '@scryfall/api-types';
import { useState } from 'react';
import { IconButton } from '@mui/material';
import FlipIcon from '@mui/icons-material/Flip';

// Base card component for non-flippable cards
const MTGCardBase = ({
    card,
    size,
}: {
    card: ScryfallCard.Any | null | undefined;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) => (
    <Scrycard
        card={card}
        symbol_text_renderer={MTGTypography}
        size={size ?? 'lg'}
        animated
        imageLink='auto'
    />
);

// Flippable card component with state and flip functionality
const MTGCardFlippable = ({
    card,
    size,
}: {
    card: ScryfallCard.Any;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) => {
    const [flipped, setFlipped] = useState<boolean>(false);

    return (
        <>
            <Scrycard
                card={card}
                symbol_text_renderer={MTGTypography}
                size={size ?? 'lg'}
                animated
                flipped={flipped}
                imageLink='auto'
            />
            <IconButton
                sx={{
                    position: 'absolute',
                    width: '14%',
                    left: '0%',
                    bottom: '3%',
                    '& svg': {
                        transform: flipped ? 'scaleX(-1)' : 'scaleX(1)',
                        transition: 'transform 0.3s ease',
                    },
                }}
                onClick={() => setFlipped((f) => !f)}
            >
                <FlipIcon color='primary' />
            </IconButton>
        </>
    );
};

export default function MTGCard(props: {
    card: ScryfallCard.Any | null | undefined;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
    if (!props.card) {
        return <Scrycard size='lg' card={null} faceDown />;
    }

    if (isFlippable(props.card)) {
        return <MTGCardFlippable card={props.card} size={props.size} />;
    }

    return <MTGCardBase card={props.card} size={props.size} />;
}
