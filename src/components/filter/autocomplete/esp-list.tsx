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
}) {
    const value = useFormControl();
    const focused = value ? value.focused : false;
    console.log(props.suggestions);
    if (props.suggestions.length == 0) return null;
    if (props.suggestions.length == 1 && props.suggestions[0] == null) return null;
    const cropped_suggestions: EspData[] = props.suggestions.map((s, i) => {
        if (s == null) return { completion: '', crop: '' };
        const completion = genCompletion(s, props.query);
        if (i == 0) {
            return { completion, crop: '' };
        }
        const offset = s.length - completion.length;
        const crop = s.slice(0, offset);
        console.log(s, offset, crop, completion);
        return { completion, crop };
    });
    console.log(cropped_suggestions);
    if (!focused) return null;
    if (cropped_suggestions.length == 0) return null;

    function ListItem({ index, style, data }: ListChildComponentProps<EspData[]>) {
        const item = data[index];
        const { width, Listener } = useWidth(item.crop);
        return (
            <>
                <Typography
                    color={'GrayText'}
                    style={{ ...style, left: props.offset - width }}
                    key={index + 'crop'}
                >
                    {data[index].crop}
                </Typography>
                <Typography
                    color={'GrayText'}
                    style={{ ...style, left: props.offset }}
                    key={index + 'comp'}
                >
                    {data[index].completion}
                </Typography>
                <Listener key={index + 'listener'} />
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
                zIndex: 1,
                top: '4px',
                left: 0,
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
