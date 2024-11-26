import MTGTypography from '../mtg-typography';
import { isFlippable, Scrycard } from 'react-scrycards';
import { ScryfallCard } from '@scryfall/api-types';
import { useState } from 'react';
import { IconButton } from '@mui/material';
import FlipIcon from '@mui/icons-material/Flip';

export default function MTGCard(props: {
    card: ScryfallCard.Any | null | undefined;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
    const [flipped, setFlipped] = useState<boolean>(false);
    const card = (
        <Scrycard
            card={props.card}
            symbol_text_renderer={MTGTypography}
            size={props.size ?? 'lg'}
            animated
            flipped={flipped}
            imageLink='auto'
        />
    );
    if (!props.card) {
        return card;
    }

    return (
        <>
            {card}
            {isFlippable(props.card) ? (
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
            ) : null}
        </>
    );
}
