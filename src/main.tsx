import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Router from './routes';
import 'react-scrycards/dist/index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <Router />
            {import.meta.env.DEV ? <ReactQueryDevtools /> : null}
        </QueryClientProvider>
    </React.StrictMode>,
);
