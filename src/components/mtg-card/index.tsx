import { Card, CardActionArea, CardContent, CardHeader } from '@mui/material';
import { IScryfallCard } from '../../types/interfaces/scryfall/cards';
import MTGTypography from '../mtg-typography';
import MTGOracleText from '../mtg-oracle-text';

export default function MTGCard(props: { card: IScryfallCard }) {
    return (
        <Card sx={{ width: '250px', margin: '5px' }}>
            <CardHeader
                title={
                    <>
                        {props.card.name}
                        <MTGTypography>{props.card.mana_cost}</MTGTypography>
                    </>
                }
            />
            <CardContent>
                <MTGOracleText>{props.card.oracle_text}</MTGOracleText>
            </CardContent>
            <CardActionArea></CardActionArea>
        </Card>
    );
}
