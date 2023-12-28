import { Chip } from '@mui/material';
import { IFilter } from '../../types/interfaces/search/filter';
import MTGTypography from '../mtg-typography';

export default function Filter(props: {
    filter: IFilter;
    setFilter: (filter: IFilter) => void;
    deleteFilter: () => void;
    color?: 'error' | 'warning' | 'info' | 'success' | 'primary';
}) {
    const color = props.color || 'primary';
    return (
        <Chip
            // sx={{ cursor: 'text' }}
            label={
                <MTGTypography>
                    {props.filter.filter + props.filter.operator + props.filter.value}
                </MTGTypography>
            }
            color={color}
            onDelete={props.deleteFilter}
        />
    );
}
