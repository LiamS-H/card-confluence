import { TextField, TextFieldVariants } from '@mui/material';
import { ChangeEvent, FocusEvent, FormEvent, useState } from 'react';

export default function TextInput(props: {
    label: string;
    variant: TextFieldVariants;
    onSubmit: (text: string) => void | Promise<void>;
    submitOnLoseFocus?: boolean;
}) {
    const [input, setInput] = useState<string>('');
    function onSubmit(e: FormEvent<HTMLFormElement>) {
        setInput('');
        props.onSubmit(input);
        e.preventDefault();
    }
    function onChange(e: ChangeEvent<HTMLInputElement>) {
        setInput(e.target.value);
    }
    function onBlur(_: FocusEvent<HTMLInputElement>) {
        if (!props.submitOnLoseFocus) return;
        props.onSubmit(input);
        setInput('');
    }

    return (
        <form onSubmit={onSubmit}>
            <TextField
                value={input}
                id={props.label}
                variant={props.variant}
                label={props.label}
                onChange={onChange}
                onBlur={onBlur}
            ></TextField>
        </form>
    );
}
