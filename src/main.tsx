import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Root from './routes/root';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <Root />
            <ReactQueryDevtools />
        </QueryClientProvider>
    </React.StrictMode>,
);
