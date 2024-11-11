import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './home';

import Error from './error';
import About from './about';
import Root from './root';

export default function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path='/' Component={Root}>
                    <Route path='/' Component={Home} />
                    <Route path='/about' Component={About} />
                    <Route path='*' Component={Error} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
