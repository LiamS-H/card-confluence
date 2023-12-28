import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    IconButton,
    Paper,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { IComposition } from '../../types/interfaces/search/composition';
import { IFilter } from '../../types/interfaces/search/filter';
import Filter from './filter';
import StringAutocomplete from './autocomplete';
import { useScryfallFilterMap } from '../../hooks/scryfall/catalog';
import TextInput from '../text-input';
import { MouseEvent, useState } from 'react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditableTypography from '../editable-typography';

export default function FilterComposition(props: {
    comp: IComposition<IFilter>;
    setComp: (comp: IComposition<IFilter> | null) => void;
    depth?: number;
    root?: boolean;
}) {
    const theme = useTheme();
    const [open, setOpen] = useState<boolean>(true);
    const { data: filterMap } = useScryfallFilterMap();
    let colorValue = theme.palette.background.paper;
    // let colorName: 'primary' | 'success' | 'info' | 'warning' | 'error' = 'primary';
    switch (props.comp.mode) {
        case 'and': {
            colorValue = theme.palette.success.main;
            // colorName = 'success';
            break;
        }
        case 'not': {
            colorValue = theme.palette.error.main;
            // colorName = 'error';
            break;
        }
        case 'or': {
            colorValue = theme.palette.info.main;
            // colorName = 'info';
            break;
        }
    }
    const depth = props.depth || 1;
    const childFilters = props.comp.components.map((filter, index) => {
        if (filter.type == 'composition') {
            return (
                <FilterComposition
                    key={`${props.depth} ${filter.name} ${index}`}
                    comp={filter}
                    setComp={(comp: IComposition<IFilter> | null) => {
                        if (comp == null) {
                            props.comp.components.splice(index, 1);
                            props.setComp(props.comp);
                            return;
                        }
                        props.comp.components[index] = comp;
                        props.setComp(props.comp);
                    }}
                    depth={depth + 1}
                />
            );
        }
        if (filter.type == 'filter') {
            return (
                <Filter
                    key={`${props.depth} ${filter.filter}${filter.operator}${filter.value} ${index}`}
                    filter={filter}
                    setFilter={(filter: IFilter) => {
                        props.comp.components[index] = filter;
                        props.setComp(props.comp);
                    }}
                    deleteFilter={() => {
                        props.comp.components.splice(index, 1);
                        props.setComp(props.comp);
                    }}
                    // color={colorName}
                />
            );
        }
    });
    const handleMode = (_: MouseEvent<HTMLElement>, mode: 'and' | 'or' | 'not' | null) => {
        if (mode == null) return;
        props.setComp({ ...props.comp, mode: mode });
    };

    function addComp(name?: string) {
        if (name === undefined || name === '') {
            name = 'new group';
        }
        const newComp: IComposition<IFilter> = {
            name: name,
            type: 'composition',
            mode: 'and',
            components: [],
        };
        props.comp.components.push(newComp);
        props.setComp(props.comp);
    }

    function addFilter(new_filter: string) {
        const new_filter_arr = new_filter.split(/(?:[=:<>]| )+/);
        const operator = new_filter.match(/(?:[=:<>]| )+/) || [':'];

        const newFilter: IFilter = {
            type: 'filter',
            filter: new_filter_arr[0].toLowerCase(),
            operator: operator[0],
            value: new_filter_arr.slice(1).join(' '),
        };
        props.comp.components.unshift(newFilter);
        props.setComp(props.comp);
    }
    return (
        <Paper
            sx={{
                width: 'fit-content',
                margin: '10px',
            }}
            elevation={depth}
        >
            <Card sx={{ width: 'fit-content' }}>
                <CardHeader
                    sx={{ backgroundColor: colorValue }}
                    title={
                        props.root ? (
                            <Typography>{props.comp.name}</Typography>
                        ) : (
                            <EditableTypography
                                placeholder='enter name'
                                setInput={(new_name: string) =>
                                    props.setComp({ ...props.comp, name: new_name })
                                }
                                input={props.comp.name}
                            />
                        )
                    }
                    action={
                        <>
                            {open ? (
                                <ToggleButtonGroup
                                    exclusive
                                    value={props.comp.mode}
                                    onChange={handleMode}
                                >
                                    <ToggleButton color='success' value='and'>
                                        and
                                    </ToggleButton>
                                    <ToggleButton color='info' value='or'>
                                        or
                                    </ToggleButton>
                                    <ToggleButton color='error' value='not'>
                                        not
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            ) : null}
                            <IconButton onClick={() => setOpen(!open)}>
                                {open ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                            </IconButton>
                        </>
                    }
                />
                {open ? (
                    <>
                        <CardActions sx={{ display: 'flex', flexFlow: 'row wrap' }}>
                            <TextInput variant={'standard'} label={'group'} onSubmit={addComp} />
                            <StringAutocomplete
                                onSubmit={addFilter}
                                map={filterMap ? filterMap : {}}
                            />

                            {!props.root ? (
                                <Button
                                    variant='outlined'
                                    color='error'
                                    onClick={() => props.setComp(null)}
                                    sx={{ marginLeft: '0px' }}
                                >
                                    DELETE
                                </Button>
                            ) : null}
                        </CardActions>
                        <CardContent sx={{ flexFlow: 'row nowrap' }}>
                            {childFilters.length > 0 ? childFilters : null}
                        </CardContent>
                    </>
                ) : null}
            </Card>
        </Paper>
    );
}
