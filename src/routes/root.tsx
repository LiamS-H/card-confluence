import { Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { Box, CssBaseline, IconButton, Tooltip, Typography } from '@mui/material';
import { Brightness4, Brightness7, Description, Info, Search } from '@mui/icons-material';

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
                <Tooltip title={'go to about.'}>
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
                </Tooltip>
            ) : null}
            {location.pathname != '/' ? (
                <Tooltip title={'go to search.'}>
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
                </Tooltip>
            ) : null}
            <Tooltip title={'go to syntaxs docs.'}>
                <IconButton
                    href={'https://scryfall.com/docs/syntax'}
                    target={'_blank'}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 32 + 32,
                        color: 'inherit',
                    }}
                >
                    <Description />
                </IconButton>
            </Tooltip>
            <Box
                sx={{
                    height: '40px', // Adjust height as needed
                    display: { xs: 'block', sm: 'block', md: 'block', lg: 'none' },
                }}
            />
            <Outlet />
            {location.pathname == '/about' ? (
                <Box>
                    <Typography>
                        Not affiliated with Wizards of the Coast LLC © or Scryfall LLC. All
                        trademarks are the property of their respective owners.
                    </Typography>
                </Box>
            ) : null}
        </ThemeProvider>
    );
}
