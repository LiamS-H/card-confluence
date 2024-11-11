import { Chip, Tooltip } from '@mui/material';
import { IFilter } from '../../types/interfaces/search/filter';
import MTGTypography from '../mtg-typography';
import { useInvalidTags } from '../../contexts/invalidTags';
import { filterToString } from '../../types/reducers/search';

export default function Filter(props: {
    filter: IFilter;
    setFilter: (filter: IFilter) => void;
    deleteFilter: () => void;
    color?: 'error' | 'warning' | 'info' | 'success' | 'primary';
}) {
    const color = props.color || 'primary';
    const invalidTags = useInvalidTags();
    const invalid: boolean = invalidTags.has(filterToString(props.filter));
    return (
        <Tooltip disableHoverListener={!props.filter.error} title={props.filter.error}>
            <Chip
                // sx={{ cursor: 'text' }}
                label={
                    <MTGTypography>
                        {props.filter.filter + props.filter.operator + props.filter.value}
                    </MTGTypography>
                }
                color={invalid ? 'error' : color}
                onDelete={props.deleteFilter}
            />
        </Tooltip>
    );
}
