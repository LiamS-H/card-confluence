import { Box } from '@mui/material';
import MTGTypography from '../mtg-typography';

export default function MTGOracleText(props: { children?: string }) {
    if (!props.children) return null;
    const sentences = props.children
        .split('\n')
        .map((sentence) => <MTGTypography key={sentence}>{sentence}</MTGTypography>);
    return <Box sx={{ display: 'flex', flexFlow: 'column wrap' }}>{sentences}</Box>;
}
