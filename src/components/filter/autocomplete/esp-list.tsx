import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useFormControl } from '@mui/material';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { genCompletion } from '../../../types/reducers/autocomplete';

export default function EspList(props: { suggestions: (string | null)[]; query: string }) {
    const value = useFormControl();
    const focused = value ? value.focused : false;
    const cropped_suggestions = props.suggestions.map((s) => genCompletion(s, props.query));
    if (!focused) return null;
    focused;
    function ListItem({ index, style, data }: ListChildComponentProps) {
        return (
            <Typography color={'GrayText'} style={style} key={index}>
                {data[index]}
            </Typography>
        );
    }
    return (
        <Box sx={{ overflow: 'visible', width: '200px', zIndex: '99' }}>
            <FixedSizeList
                height={100}
                width={'100%'}
                itemSize={20}
                itemCount={cropped_suggestions.length}
                itemData={cropped_suggestions}
                overscanCount={5}
                style={{
                    top: '4px',
                    position: 'absolute',
                    overflowY: 'hidden',
                    overflowX: 'hidden',
                    maxHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {ListItem}
            </FixedSizeList>
        </Box>
    );
}
