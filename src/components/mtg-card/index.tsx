import MTGTypography from '../mtg-typography';
import { Scrycard } from 'react-scrycards';
import { ScryfallCard } from '@scryfall/api-types';

export default function MTGCard(props: {
    card: ScryfallCard.Any | null | undefined;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
    const card = (
        <Scrycard
            card={props.card}
            symbol_text_renderer={MTGTypography}
            size={props.size ?? 'lg'}
            animated
        />
    );
    if (!props.card?.scryfall_uri) {
        return card;
    }
    return (
        <a href={props.card.scryfall_uri} target='_blank' rel='noopener noreferrer'>
            {card}
        </a>
    );
}
