import { useScryfallSymbols } from '../../hooks/scryfall/symbols';
import { IScrytextProps, Scrytext } from 'react-scrycards';

export default function MTGTypography(props: IScrytextProps) {
    const symbolQuery = useScryfallSymbols();
    if (!props.children) return null;
    if (!symbolQuery.data) return <span {...props}>{props.children}</span>;
    return <Scrytext symbols={symbolQuery.data}>{props.children}</Scrytext>;
}
