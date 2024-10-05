import { FormControl, TextField } from '@mui/material';
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { IFastAutocompleteMap } from '../../../types/interfaces/search/autcomplete';
import EspList from './esp-list';
import { genEsp } from '../../../types/reducers/autocomplete';

export default function StringAutocomplete(props: {
    map: IFastAutocompleteMap;
    onSubmit: (result: string) => Promise<void> | void;
}) {
    const [input, setInput] = useState<string>('');
    const [esp, setEsp] = useState<string[]>([]);
    const [queryParts, setQueryParts] = useState<string[]>([]);

    useEffect(() => {
        if (!props.map) {
            return;
        }
        const queryList: string[] = [];
        setEsp(Array.from(genEsp(props.map, input)).filter((n) => n !== null));
        setQueryParts(queryList);
    }, [input, props.map]);

    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const new_input = complete();
        setInput('');
        props.onSubmit(new_input);
    }

    function complete(): string {
        if (esp.length == 0) return input;
        const new_input = input + esp[0].slice(queryParts[queryParts.length - 1].length);
        setInput(new_input);
        return new_input;
    }
    function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
        if (e.key == 'Tab') {
            e.preventDefault();
            complete();
        }
    }

    return (
        <form
            style={{ marginLeft: '0px' }}
            onSubmit={onSubmit}
            onKeyDown={onKeyDown}
            noValidate
            autoComplete='off'
        >
            <FormControl>
                <TextField
                    value={input}
                    label='add filter'
                    onChange={(event) => {
                        const newText = event.target.value;
                        setInput(newText);
                    }}
                    sx={{
                        // minWidth: '100px',
                        // width: '100px',
                        display: 'flex',
                        flexShrink: 1,
                    }}
                    variant='standard'
                    InputProps={{
                        inputProps: {
                            style: { textAlign: 'right' },
                        },
                        endAdornment: (
                            <EspList
                                suggestions={esp}
                                cursorIndex={
                                    queryParts.length > 0
                                        ? queryParts[queryParts.length - 1].length
                                        : 0
                                }
                            />
                        ),
                    }}
                />
            </FormControl>
        </form>
    );
}
