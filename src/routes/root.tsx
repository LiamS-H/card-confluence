import { Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { CssBaseline, IconButton, Tooltip } from '@mui/material';
import { Brightness4, Brightness7, Info, Search } from '@mui/icons-material';

export default function Root() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const location = useLocation();
    const MUItheme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: theme,
                },
            }),
        [theme],
    );

    const handleThemeToggle = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeProvider theme={MUItheme}>
            <CssBaseline />
            <Tooltip title='click to toggle dark theme.'>
                <IconButton
                    onClick={handleThemeToggle}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        color: 'inherit',
                    }}
                >
                    {theme === 'dark' ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
            </Tooltip>
            {location.pathname != '/about' ? (
                <IconButton
                    href={'/about'}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        color: 'inherit',
                    }}
                >
                    <Info />
                </IconButton>
            ) : null}
            {location.pathname != '/' ? (
                <IconButton
                    href={'/'}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        color: 'inherit',
                    }}
                >
                    <Search />
                </IconButton>
            ) : null}
            <Outlet />
        </ThemeProvider>
    );
}
