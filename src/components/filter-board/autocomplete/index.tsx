import { Box, Button, FormControl, TextField } from '@mui/material';
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { IFastAutocompleteMap } from '../../../types/interfaces/search/autcomplete';
import EspList from './esp-list';
import { genCompletion, genEsp } from '../../../types/reducers/autocomplete';
import useWidth from '../../../hooks/width';

export default function StringAutocomplete(props: {
    map: IFastAutocompleteMap;
    addFilter: (result: string) => Promise<void> | void;
}) {
    const [input, setInput] = useState<string>('');
    const [suggestions, setSuggestions] = useState<(string | null)[]>([]);
    const [index, setIndex] = useState(0);
    const [queryPart, setQueryPart] = useState<string>('');
    const { Listener, width } = useWidth(input);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!props.map) {
            return;
        }
        const queryList: string[] = [];
        const new_esp = Array.from(genEsp(props.map, input, queryList));
        setSuggestions(new_esp);
        const new_queryPart = queryList.at(-1);
        setQueryPart(new_queryPart !== undefined ? new_queryPart : '');
    }, [input, props.map]);

    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const new_input = complete();
        setInput('');
        props.addFilter(new_input);
    }

    function complete(): string {
        if (suggestions.length == 0) return input;
        let new_input;
        if (!suggestions.includes(null) && suggestions[index] !== null) {
            let selection = suggestions[index];
            new_input = input + genCompletion(selection, queryPart);
            selection = '';
        }
        new_input ??= input;
        setInput(new_input);
        setIndex(0);
        return new_input;
    }
    function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
        if (e.key == 'Tab') {
            e.preventDefault();
            complete();
        }
        if (e.key == 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => (i - 1) % suggestions.length);
        }
        if (e.key == 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => (i + 1) % suggestions.length);
        }
    }

    const suggestion_len = focused ? Math.max(Math.min(suggestions.length, 5), 1) - 1 : 0;
    const height = suggestion_len * 20 + 30;

    return (
        <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate autoComplete='off'>
            <Box
                sx={{
                    marginLeft: '0px',
                    // height: 6 * 20,
                    display: 'flex',
                    flexFlow: 'row nowrap',
                }}
            >
                <FormControl>
                    <Listener />
                    <TextField
                        value={input}
                        label='add filter'
                        onChange={(event) => {
                            const newText = event.target.value;
                            setInput(newText);
                        }}
                        sx={
                            {
                                // height:,
                                // minWidth: '100px',
                                // width: '100px',
                                // display: 'flex',
                                // alignItems: 'flex-end',
                                // flexShrink: 1,
                            }
                        }
                        variant='standard'
                        FormHelperTextProps={{
                            sx: {
                                // height: height,
                            },
                        }}
                        InputProps={{
                            // style: { overflow: 'visible' },
                            sx: {
                                height: height,
                                alignItems: 'flex-start',
                            },

                            endAdornment: (
                                <EspList
                                    setFocused={setFocused}
                                    suggestions={suggestions}
                                    query={queryPart}
                                    offset={width}
                                    index={index}
                                />
                            ),
                        }}
                    />
                </FormControl>
            </Box>
        </form>
    );
}
