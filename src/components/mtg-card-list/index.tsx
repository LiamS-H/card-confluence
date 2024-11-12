import { Box } from '@mui/material';
import MTGCard from '../mtg-card';
import { ScryfallCard } from '@scryfall/api-types';

export default function MTGCardList(props: { cards?: ScryfallCard.Any[] }) {
    if (props.cards === undefined) return <h1>loading...</h1>;
    if (props.cards.length === 0) return <h1>no results</h1>;
    const disp_cards = props.cards.map((card) => <MTGCard key={card.id} card={card} />);
    return <Box sx={{ display: 'flex', flexFlow: 'row wrap' }}>{disp_cards}</Box>;
}
