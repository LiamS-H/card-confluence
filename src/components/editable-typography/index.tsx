import { FormControl, TextField, Typography, TypographyProps } from '@mui/material';
import { ChangeEvent, FocusEvent, FormEvent, useState } from 'react';

interface EditableTypographyProps extends TypographyProps {
    setInput: (new_input: string) => void;
    readonly input: string;
    placeholder: string;
}

export default function EditableTypography(props: EditableTypographyProps) {
    const [active, setActive] = useState<boolean>(false);
    const [localInput, setLocalInput] = useState<string>(props.input);
    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setActive(false);
        props.setInput(localInput);
    }
    function handleBlur(_: FocusEvent<HTMLInputElement>) {
        setActive(false);
        props.setInput(localInput);
    }
    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        setLocalInput(e.target.value);
    }
    function handleClick() {
        setActive(true);
    }

    if (!active && !(props.input == '')) {
        return (
            <Typography onClick={handleClick} variant={props.variant}>
                {localInput}
            </Typography>
        );
    }

    return (
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
    );
}
