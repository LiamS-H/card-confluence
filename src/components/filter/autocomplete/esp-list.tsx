import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useFormControl } from '@mui/material';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { genCompletion } from '../../../types/reducers/autocomplete';
function ListItem({ index, style, data }: ListChildComponentProps) {
    return (
        <Typography color={'GrayText'} style={style} key={index}>
            {data[index]}
        </Typography>
    );
}

export default function EspList(props: {
    suggestions: (string | null)[];
    query: string;
    offset: number;
}) {
    const value = useFormControl();
    const focused = value ? value.focused : false;
    const cropped_suggestions = props.suggestions.map((s) => genCompletion(s, props.query));
    if (!focused) return null;
    if (cropped_suggestions.length == 0) return null;
    if (cropped_suggestions.length == 1 && cropped_suggestions[0].length == 0) return null;

    return (
        <FixedSizeList
            height={100}
            width={'100%'}
            itemSize={20}
            itemCount={cropped_suggestions.length}
            itemData={cropped_suggestions}
            overscanCount={5}
            style={{
                zIndex: 1,
                top: '4px',
                left: props.offset,
                position: 'absolute',
                overflowY: 'hidden',
                overflowX: 'hidden',
                maxHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(0,0,0,0.1)',
            }}
        >
            {ListItem}
        </FixedSizeList>
    );
}
