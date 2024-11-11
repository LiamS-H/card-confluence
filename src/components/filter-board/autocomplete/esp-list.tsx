import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useFormControl } from '@mui/material';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { genCompletion } from '../../../types/reducers/autocomplete';
import useWidth from '../../../hooks/width';

interface EspData {
    completion: string;
    crop: string;
}

export default function EspList(props: {
    suggestions: (string | null)[];
    query: string;
    offset: number;
    index: number;
}) {
    const value = useFormControl();
    const focused = value ? value.focused : false;
    if (props.suggestions.length == 0) return null;
    if (props.suggestions.length == 1 && props.suggestions[0] == null) return null;
    // console.log(props.suggestions);
    const cropped_suggestions: EspData[] = props.suggestions.map((s, i) => {
        if (s == null) return { completion: '', crop: '' };
        const completion = genCompletion(s, props.query);
        const offset = s.length - completion.length;
        const crop = s.slice(0, offset);
        return { completion, crop };
    });
    if (!focused) return null;
    if (cropped_suggestions.length == 0) return null;

    function ListItem({ index, style, data }: ListChildComponentProps<EspData[]>) {
        const adjustedIndex = (data.length + index + props.index) % data.length;
        const item = data[adjustedIndex];
        if (index == 0) {
            item.crop = '';
        }
        const { width, Listener } = useWidth(item.crop);
        return (
            <>
                <Typography
                    color={'GrayText'}
                    style={{ ...style, left: props.offset - width }}
                    key={adjustedIndex + 'crop'}
                >
                    {data[adjustedIndex].crop}
                </Typography>
                <Typography
                    color={'GrayText'}
                    style={{ ...style, left: props.offset }}
                    key={adjustedIndex + 'comp'}
                >
                    {data[adjustedIndex].completion}
                </Typography>
                <Listener key={adjustedIndex + 'listener'} />
            </>
        );
    }

    return (
        <FixedSizeList<EspData[]>
            height={100}
            width={'100%'}
            itemSize={20}
            itemCount={cropped_suggestions.length}
            itemData={cropped_suggestions}
            overscanCount={5}
            style={{
                zIndex: 10,
                top: '4px',
                left: 0,
                position: 'absolute',
                overflowY: 'hidden',
                overflowX: 'hidden',
                maxHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(0,0,0,0.8)',
            }}
        >
            {ListItem}
        </FixedSizeList>
    );
}
