import { Chip, FormControl, Input, TextField, Tooltip } from '@mui/material';
import { IFilter } from '../../types/interfaces/search/filter';
import MTGTypography from '../mtg-typography';
import { useTagMessage } from '../../contexts/invalidTags';
import { ChangeEvent, FormEvent, useState } from 'react';
import { stringToFilter } from '../../types/reducers/search';

export default function Filter(props: {
    filter: IFilter;
    setFilter: (filter: IFilter) => void;
    deleteFilter: () => void;
    color?: 'error' | 'warning' | 'info' | 'success' | 'primary';
}) {
    const color = props.color || 'primary';
    const tagMessage = useTagMessage(props.filter);
    const [isEditing, setIsEditing] = useState(false);
    const [localInput, setLocalInput] = useState<string>(
        props.filter.filter + props.filter.operator + props.filter.value,
    );
    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsEditing(false);
        props.setFilter(stringToFilter(localInput));
    }
    function handleBlur() {
        setIsEditing(false);
        props.setFilter(stringToFilter(localInput));
    }
    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        setLocalInput(e.target.value);
    }
    function handleClick() {
        setIsEditing(true);
    }

    if (isEditing) {
        return (
            <Chip
                // sx={{ cursor: 'text' }}
                label={
                    <form onSubmit={handleSubmit}>
                        <FormControl>
                            <TextField
                                placeholder='enter name'
                                autoFocus
                                variant='standard'
                                value={localInput}
                                onBlur={handleBlur}
                                onChange={handleChange}
                                sx={{ cursor: 'text' }}
                            />
                        </FormControl>
                    </form>
                }
                color={tagMessage ? 'error' : color}
                onDelete={props.deleteFilter}
                onClick={() => {}}
            />
        );
    }

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
                onClick={handleClick}
            />
        </Tooltip>
    );
}
