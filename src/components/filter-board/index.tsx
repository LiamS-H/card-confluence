import { Box } from '@mui/material';
import Composition from './composition';
import { IComposition } from '../../types/interfaces/search/composition';
import { IFilter } from '../../types/interfaces/search/filter';
import { ISearch } from '../../types/interfaces/search/search';
import { InvalidTagsProvider } from '../../contexts/invalidTags';

function parseMessage(message: string[] | null): Record<string, string> {
    const invalidTags: Record<string, string> = {};
    if (message == null) return invalidTags;
    const text = message.join(' ');
    const regex = /Invalid expression “([^”]+)” was ignored\. (Unknown keyword “[^”]+”)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const [_, expression, message] = match;
        invalidTags[expression] = message;
    }

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
