import { Typography, TypographyProps } from '@mui/material';
import { useScryfallSymbols } from '../../hooks/scryfall/symbols';

interface MTGTypographyProps extends TypographyProps {
    children?: string;
}

export default function MTGTypography(props: MTGTypographyProps) {
    const symbolQuery = useScryfallSymbols();
    if (!props.children) return null;
    if (!symbolQuery.data) return <Typography {...props}>{props.children}</Typography>;
    if (props.children.length === 0) return <Typography {...props}>{props.children}</Typography>;
    const regex = /\{([^}]+)\}/g;
    let match;
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    while ((match = regex.exec(props.children)) !== null) {
        elements.push(
            <span key={lastIndex}>{props.children.slice(lastIndex, match.index).trim()}</span>,
        );

        const symbolName = '{' + match[1].toUpperCase() + '}';
        const symbol = symbolQuery.data[symbolName];
        if (symbol) {
            elements.push(
                <img
                    key={`${symbolName} ${match.index}`}
                    src={symbol.uri}
                    alt={symbolName}
                    style={{ height: '1em', verticalAlign: 'middle' }}
                />,
            );
        } else {
            elements.push(<span key={match.index}>{match[0]}</span>);
        }
        lastIndex = regex.lastIndex;
    }

    elements.push(<span key={lastIndex}>{props.children.slice(lastIndex).trim()}</span>);

    return <span>{elements}</span>;
}
