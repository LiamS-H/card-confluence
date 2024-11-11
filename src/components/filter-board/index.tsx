import { Box } from '@mui/material';
import Composition from './composition';
import { IComposition } from '../../types/interfaces/search/composition';
import { IFilter } from '../../types/interfaces/search/filter';
import { ISearch } from '../../types/interfaces/search/search';
import { InvalidTagsProvider } from '../../contexts/invalidTags';

function parseMessage(message: string[] | null): Set<string> | null {
    const invalidTags = new Set<string>();
    if (message == null) return invalidTags;
    const text = message.join(' ');
    const matches = text.match(/Invalid expression “([^”]*)”/g);
    if (!matches) return invalidTags;
    matches.map((match) => match.match(/“([^”]*)”/)?.[1] ?? '').forEach((t) => invalidTags.add(t));
    return invalidTags;
}

export default function FilterBoard(props: {
    search: ISearch;
    searchString: string;
    setSearch: React.Dispatch<React.SetStateAction<ISearch>>;
    message: string[] | null;
}) {
    const invalidTags = parseMessage(props.message);
    return (
        <InvalidTagsProvider value={invalidTags}>
            <Box>
                <p>{props.searchString}</p>
                <p>{props.message}</p>
                <Composition
                    comp={props.search.domain}
                    root
                    setComp={(comp: IComposition<IFilter> | null) => {
                        if (comp == null) return;
                        props.setSearch((searchObj) => ({ ...searchObj, domain: comp }));
                    }}
                />
                <Composition
                    comp={props.search.filters}
                    root
                    setComp={(comp: IComposition<IFilter> | null) => {
                        if (comp == null) return;
                        props.setSearch((searchObj) => ({ ...searchObj, filters: comp }));
                    }}
                />
            </Box>
        </InvalidTagsProvider>
    );
}
