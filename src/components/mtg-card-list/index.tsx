import { Box } from '@mui/material';
import { IScryfallCard } from '../../types/interfaces/scryfall/cards';
import MTGCard from '../mtg-card';

export default function MTGCardList(props: { cards?: IScryfallCard[] }) {
    if (props.cards === undefined) return <h1>loading...</h1>;
    if (props.cards.length === 0) return <h1>no results</h1>;
    const disp_cards = props.cards.map((card) => <MTGCard key={card.id} card={card} />);
    return <Box sx={{ display: 'flex', flexFlow: 'row wrap' }}>{disp_cards}</Box>;
}
