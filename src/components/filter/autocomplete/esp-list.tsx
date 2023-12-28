import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useFormControl } from '@mui/material';

export default function EspList(props: { suggestions: string[]; cursorIndex: number }) {
    const value = useFormControl();
    const focused = value ? value.focused : false;
    // if (!focused) return null;
    return (
        <Box sx={{ overflow: 'visible', width: '200px', zIndex: '99' }}>
            <div
                style={{
                    top: '4px',
                    position: 'absolute',
                    overflowY: 'hidden',
                    maxHeight: '200px',
                }}
            >
                {focused &&
                    props.suggestions.map((suggestion, index) => (
                        <Typography
                            key={suggestion}
                            color='GrayText'
                            sx={{
                                backgroundColor: index < 2 ? 'transparent' : '#1E1E1E', //FIX make it use the style
                                // cursor: 'pointer',
                                zIndex: 999,
                            }}
                        >
                            {suggestion.slice(props.cursorIndex)}
                        </Typography>
                    ))}
            </div>
        </Box>
    );
}
