import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Home from './home';
import { useMemo, useState } from 'react';
import { CssBaseline } from '@mui/material';

export default function Root() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const MUItheme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: theme,
                },
            }),
        [theme],
    );
    setTheme;
    return (
        <ThemeProvider theme={MUItheme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route path='/' Component={Home} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}
