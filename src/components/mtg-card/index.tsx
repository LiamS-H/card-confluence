import MTGTypography from '../mtg-typography';
import { Scrycard } from 'react-scrycards';
import { ScryfallCard } from '@scryfall/api-types';

export default function MTGCard(props: { card: ScryfallCard.Any | null | undefined }) {
    return <Scrycard card={props.card} symbol_text_renderer={MTGTypography} size='lg' animated />;
}
