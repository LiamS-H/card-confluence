import { createContext, useContext } from 'react';

const InvalidTagscontext = createContext<Set<string> | null>(null);

export const InvalidTagsProvider = InvalidTagscontext.Provider;

export function useInvalidTags(): Set<string> {
    const context = useContext(InvalidTagscontext);
    if (context == null) throw Error('invalid tags context must be used within provider.');
    return context;
}
