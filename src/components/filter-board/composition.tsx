import {
    Box,
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
import { IFilter, isOperator } from '../../types/interfaces/search/filter';
import Filter from './filter';
import StringAutocomplete from './autocomplete';
import { useScryfallFilterMap } from '../../hooks/scryfall/catalog';
import { MouseEvent, useState } from 'react';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddBoxIcon from '@mui/icons-material/AddBox';
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
                    key={filter.id}
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
        let id = name;
        let i = 0;
        while (
            props.comp.components.find((comp) => {
                if (comp.type != 'composition') return false;
                return comp.id == id;
            })
        ) {
            id = name + i;
            i++;
        }
        const newComp: IComposition<IFilter> = {
            id: id,
            name: name,
            type: 'composition',
            mode: 'and',
            components: [],
        };
        props.comp.components.push(newComp);
        props.setComp(props.comp);
    }

    // TO-DO use the string reducers from reducers instaed of rewrite, also look if this i better
    function addFilter(new_filter: string) {
        const new_filter_arr = new_filter.split(/(?:[=:<>]| )+/);

        if (new_filter_arr.length === 1) {
            addComp(new_filter);
            return;
        }

        const match = new_filter.match(/(?:[=:<>]| )+/) || [':'];
        const operator = isOperator(match[0]) ? match[0] : ':';

        const newFilter: IFilter = {
            type: 'filter',
            filter: new_filter_arr[0].toLowerCase(),
            operator: operator,
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
                overflowY: 'visible',
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
                            {open && !props.root ? (
                                <ToggleButtonGroup
                                    exclusive
                                    value={props.comp.mode}
                                    onChange={handleMode}
                                    color='standard'
                                >
                                    <ToggleButton value='and'>and</ToggleButton>
                                    <ToggleButton value='or'>or</ToggleButton>
                                    <ToggleButton value='not'>not</ToggleButton>
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
                        <CardActions
                            sx={{
                                alignItems: 'flex-start',
                                gap: '10px',
                            }}
                        >
                            <StringAutocomplete
                                addFilter={addFilter}
                                map={
                                    filterMap
                                        ? filterMap
                                        : {
                                              sorted_options: [],
                                              singlemap: {},
                                          }
                                }
                            />
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexFlow: 'row nowrap',
                                    justifyContent: 'flex-start',
                                    gap: '10px',
                                    height: '50px',
                                }}
                            >
                                <Button
                                    variant='outlined'
                                    color='success'
                                    onClick={() => addFilter('')}
                                    sx={{}}
                                >
                                    GROUP
                                    <AddBoxIcon />
                                </Button>
                                {!props.root ? (
                                    <Button
                                        variant='outlined'
                                        color='error'
                                        onClick={() => props.setComp(null)}
                                        sx={{}}
                                    >
                                        DELETE
                                        <DeleteForeverIcon />
                                    </Button>
                                ) : null}
                            </Box>
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
