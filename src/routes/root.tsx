import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Home from './home';
import { useMemo, useState } from 'react';
import { CssBaseline } from '@mui/material';
import Error from './error';
import About from './about';

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
                    <Route path='/about' Component={About} />
                    <Route path='*' Component={Error} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}
