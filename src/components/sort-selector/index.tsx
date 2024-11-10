import { MenuItem, Select, FormControl, InputLabel, Box } from '@mui/material';

// Constant lists of options

import { orders, directions } from '../../types/interfaces/search/search';

interface SortSelectorsProps {
    order: string;
    direction: string;
    onOrderChange: (value: string) => void;
    onDirectionChange: (value: string) => void;
}

export default function SortSelectors(props: SortSelectorsProps) {
    return (
        <Box display='flex' flexDirection='row' width='100%' justifyContent='space-between' gap='1'>
            <Box display='flex' flexGrow='1'></Box>
            <Box display='flex' flexShrink='1' minWidth='400px' gap='10px'>
                {/* Order Selector */}
                <FormControl variant='outlined' fullWidth margin='normal'>
                    <InputLabel>Order By</InputLabel>
                    <Select
                        value={props.order}
                        onChange={(e) => props.onOrderChange(e.target.value)}
                        label='Order By'
                    >
                        {orders.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Direction Selector */}
                <FormControl variant='outlined' fullWidth margin='normal'>
                    <InputLabel>Direction</InputLabel>
                    <Select
                        value={props.direction}
                        onChange={(e) => props.onDirectionChange(e.target.value)}
                        label='Direction'
                    >
                        {directions.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
        </Box>
    );
}
