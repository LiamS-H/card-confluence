import { Chip, Tooltip } from '@mui/material';
import { IFilter } from '../../types/interfaces/search/filter';
import MTGTypography from '../mtg-typography';
import { useTagMessage } from '../../contexts/invalidTags';

export default function Filter(props: {
    filter: IFilter;
    setFilter: (filter: IFilter) => void;
    deleteFilter: () => void;
    color?: 'error' | 'warning' | 'info' | 'success' | 'primary';
}) {
    const color = props.color || 'primary';
    const tagMessage = useTagMessage(props.filter);
    return (
        <Tooltip disableHoverListener={!tagMessage} title={tagMessage}>
            <Chip
                // sx={{ cursor: 'text' }}
                label={
                    <MTGTypography>
                        {props.filter.filter + props.filter.operator + props.filter.value}
                    </MTGTypography>
                }
                color={tagMessage ? 'error' : color}
                onDelete={props.deleteFilter}
            />
        </Tooltip>
    );
}
