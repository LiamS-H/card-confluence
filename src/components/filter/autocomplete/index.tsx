import { FormControl, TextField } from '@mui/material';
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { IAutocompleteMap } from '../../../types/interfaces/search/autcomplete';
import EspList from './esp-list';
import { stringBSearch } from '../../../services/utils/bsearch';

export default function StringAutocomplete(props: {
    map: IAutocompleteMap;
    onSubmit: (result: string) => Promise<void> | void;
}) {
    const [input, setInput] = useState<string>('');
    const [esp, setEsp] = useState<string[]>([]);
    const [queryParts, setQueryParts] = useState<string[]>([]);
    function isStringArray(value: any): value is string[] {
        return Array.isArray(value);
    }
    useEffect(() => {
        if (!props.map) {
            return;
        }
        const queryList: string[] = [];
        setEsp(genEsp(props.map, input, queryList));
        setQueryParts(queryList);
    }, [input, props.map]);

    function match(wordbank: string[], text: string): string[] {
        const start = stringBSearch(wordbank, text);
        const end = stringBSearch(wordbank, text + '🞿');
        return wordbank.slice(start, end).slice(0, 10);
    }
    function genEsp(map: IAutocompleteMap, text: string, queryList?: string[]): string[] {
        if (!queryList) queryList = [];
        const text_lower = text.toLowerCase();
        if (!map.tree) {
            const last_word = text.split(' ').splice(-1)[0];
            if (!map.freeSolo || !map.wordbank) return [];
            queryList.push(last_word);
            if (isStringArray(map.wordbank)) return match(map.wordbank, last_word);
            return genEsp(map.wordbank, last_word, queryList);
        }
        if (isStringArray(map.tree)) {
            queryList.push(text_lower);
            return map.tree.filter((filter) => filter.startsWith(text_lower));
        }
        for (let i = text_lower.length; i > 0; i--) {
            const substr = text_lower.substring(0, i);
            if (map.tree[substr]) {
                const nextMap = map.tree[substr];
                const nextStr = text_lower.substring(i, text_lower.length);
                queryList.push(substr);
                if (isStringArray(nextMap)) {
                    queryList.push(nextStr);
                    return nextMap.filter((filter) => filter.startsWith(nextStr));
                }
                return genEsp(nextMap, text_lower.substring(i, text_lower.length), queryList);
            }
        }
        queryList.push(text_lower);
        const suggestions: string[] = [];
        for (const [filter, _] of Object.entries(map.tree)) {
            if (filter.startsWith(text_lower)) {
                suggestions.push(filter);
            }
        }
        if (map.freeSolo) {
            suggestions.push(text_lower);
        }
        return suggestions;
    }

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
                    label='filter'
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
