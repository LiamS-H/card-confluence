import { stringBSearch } from '../../services/utils/bsearch';
import {
    IAutocompleteMap,
    IAutocompleteNode,
    IFastAutocompleteMap,
    IFastAutocompleteNode,
    ISingleMap,
} from '../interfaces/search/autcomplete';

function slowToFastAutocompleteNode(slow_node: IAutocompleteNode): IFastAutocompleteNode {
    if (slow_node === null) return null;
    if (Array.isArray(slow_node)) {
        const new_list: string[] = [];
        let terminating = false;
        for (const item of slow_node) {
            if (item === null) {
                terminating = true;
                continue;
            }
            new_list.push(item);
        }
        return {
            terminating: terminating ? true : undefined,
            singlemap: {},
            sorted_options: new_list.sort(),
        };
    }
    const singlemap: ISingleMap<IFastAutocompleteNode> = {};
    if (slow_node.singlemap) {
        for (const key in slow_node.singlemap) {
            const next_node = slow_node.singlemap[key];
            singlemap[key] = slowToFastAutocompleteNode(next_node);
        }
    }
    if (slow_node.wordbank) {
        for (const word of slow_node.wordbank) {
            if (singlemap[word] === null) continue;
            if (singlemap[word] === undefined) {
                singlemap[word] = null;
                continue;
            }
            singlemap[word].terminating = true;
        }
    }
    if (slow_node.multimaps) {
        for (const map of slow_node.multimaps) {
            const node = map.node;
            for (const key of map.keys) {
                singlemap[key] = slowToFastAutocompleteNode(node);
            }
        }
    }

    const sorted_options = Object.keys(singlemap).sort();
    const fast_node: IFastAutocompleteMap = {
        sorted_options: sorted_options,
        singlemap: singlemap,
        forceUniqueRepeats: slow_node.forceUniqueRepeats,
        repeating: slow_node.repeating,
        freesolo: slow_node.freesolo,
        prefix: slow_node.prefix,
        // suffix: slow_node.suffix ? slow_node.suffix : slow_node.repeating ? ' ' : undefined,
        suffix: slow_node.suffix,
        terminating: slow_node.terminating,
    };

    return fast_node;
}

export function genFastAutocomplete(slow_map: IAutocompleteMap): IFastAutocompleteMap {
    const fast_node = slowToFastAutocompleteNode(slow_map);
    if (fast_node === null) {
        return {
            singlemap: {},
            sorted_options: [],
        };
    }
    return fast_node;
}
function match(wordbank: string[], text: string): Set<string> {
    const start = Math.max(stringBSearch(wordbank, text) - 1, 0);
    const end = stringBSearch(wordbank, text + String.fromCodePoint(0x10ffff));
    return new Set<string>(wordbank.slice(start, end));
}
export function genEsp(
    map: IFastAutocompleteMap,
    text: string,
    queryList: string[],
    repeatNode?: IFastAutocompleteMap,
): Set<string | null> {
    repeatNode = map.repeating ? map : repeatNode;
    map.prefix ??= '';
    map.suffix ??= '';

    const og_text = text;

    const suggestions: Set<string | null> = new Set();

    if (
        map.terminating &&
        text.length - map.prefix.length === 0 &&
        (!map.prefix || !text.startsWith(map.prefix))
    ) {
        suggestions.add(null);
    }

    if (map.prefix && !text.startsWith(map.prefix)) {
        if (text === '') suggestions.add(map.prefix);
        return suggestions;
    }
    if (map.prefix) {
        text = text.slice(map.prefix.length);
    }

    if (text === '') {
        if (map.terminating && map.suffix) suggestions.add(map.suffix);
        map.sorted_options.forEach((option) => suggestions.add(option));
        return suggestions;
    }

    const options = match(map.sorted_options, text.slice(0, 1));
    if (map.freesolo) {
        options.add(text.slice(0, -1));
    }

    for (const option of options) {
        if (text.startsWith(option)) {
            const new_map = map.singlemap[option];
            const cropped_text = text.slice(option.length);

            let new_suggestions = new Set<string | null>();
            if (new_map) {
                new_suggestions = genEsp(new_map, cropped_text, queryList, repeatNode);
            }

            if (
                !new_map &&
                ((cropped_text == '' && !map.suffix) ||
                    (map.suffix && cropped_text.startsWith(map.suffix)))
            ) {
                new_suggestions.add(null);
            }
            if (
                !new_map &&
                cropped_text == '' &&
                map.suffix &&
                !cropped_text.startsWith(map.suffix)
            ) {
                new_suggestions.add(map.suffix);
            }

            if (new_map?.terminating && cropped_text == '') {
                new_suggestions.add(null);
            }

            new_suggestions.forEach((suggestion) => suggestions.add(suggestion));

            // this naively crops based only one 1 depth of tree. The function must return the text from the explored tree in order to know where to crop for suffix.
            if (suggestions.has(null) && map.suffix && !cropped_text.includes(map.suffix)) {
                suggestions.add(map.suffix);
                suggestions.delete(null);
            }

            // for now I am going to assume suffixes are unique and crop until the suffix
            // in future should look at querylist to know where to slice

            if (repeatNode && map.suffix && cropped_text.includes(map.suffix)) {
                const slice_index = cropped_text.indexOf(map.suffix) + 1;
                const post_suf = cropped_text.slice(slice_index);
                const pre_suf = cropped_text.slice(0, slice_index);
                if (post_suf !== '') {
                    suggestions.delete(null);
                    // suggestions.add(null);
                    // continue;
                }
                const new_suggestions = genEsp(repeatNode, post_suf, queryList);
                new_suggestions.forEach((suggestion) => suggestions.add(suggestion));
            }
            if (repeatNode && !map.suffix && map.repeating) {
                const new_map = { ...repeatNode };
                if (map.forceUniqueRepeats) {
                    new_map.sorted_options = new_map.sorted_options.filter((n) => n !== option);
                    delete new_map.singlemap[option];
                }

                const new_suggestions = genEsp(new_map, cropped_text, queryList);
                new_suggestions.forEach((suggestion) => suggestions.add(suggestion));
            }

            continue;
        }
        if (option.startsWith(text)) {
            suggestions.add(option);
        }
    }

    if (!((suggestions.size === 1 && suggestions.has(null)) || suggestions.size == 0)) {
        queryList.unshift(og_text);
    }

    return suggestions;
}

export function genCompletion(suggestion: string | null, query: string): string {
    if (suggestion === null) return '';
    if (query === '') return suggestion;
    if (suggestion === '') return '';

    for (let i = 0; i < query.length; i++) {
        if (suggestion.startsWith(query.slice(i))) {
            return suggestion.slice(query.length - i);
        }
    }
    return suggestion;
}
