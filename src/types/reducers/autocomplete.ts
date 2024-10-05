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
        prefix: slow_node.prefix,
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
    repeatNode?: IFastAutocompleteMap,
): Set<string | null> {
    console.log(`"${text}" with map:`, map);
    repeatNode = map.repeating ? map : repeatNode;

    if (map === undefined) return new Set<string | null>(null);

    map.prefix ??= '';
    map.suffix ??= '';

    //handle prefix

    //dead end
    if (map.sorted_options.length == 0) {
        return new Set<string>();
    }

    const suggestions: Set<string | null> = new Set();
    // if (map.terminating && map.suffix) {
    //     suggestions.add(map.suffix);
    // }

    if (map.prefix) {
        if (text === '') {
            console.log('prefixating', text, map.prefix);
            suggestions.add(map.prefix);
            return suggestions;
        }
        if (!text.startsWith(map.prefix)) {
            return suggestions;
        }
        text = text.slice(map.prefix.length);
    }

    const options = match(map.sorted_options, text.slice(0, 1));
    console.log(text.length, `"${text}" o:`, options);

    if (text === '') {
        options.forEach((option) => suggestions.add(option));
        if (map.terminating) suggestions.add(null);
    }

    const endings: Set<string> = new Set();

    for (const option of options) {
        if (text.startsWith(option)) {
            const new_map = map.singlemap[option];

            console.log('exploring text', text, 'down', option, '@', map);
            // if (!new_map) return map.suffix ? [map.suffix] : [];
            if (!new_map) {
                suggestions.add(null);
                endings.add(option);
                continue;
            }
            let cropped_text = text.slice(option.length);

            if (
                repeatNode &&
                new_map.terminating &&
                map.suffix &&
                cropped_text.startsWith(map.suffix)
            ) {
                console.log('suffixiating', map.suffix);
                cropped_text = cropped_text.slice(1);
                const new_suggestions = genEsp(repeatNode, cropped_text);
                new_suggestions.forEach((suggestion) => suggestions.add(suggestion));
                continue;
            }

            const new_suggestions = genEsp(new_map, cropped_text, repeatNode);
            console.log('new_suggestions for', option, new_suggestions);
            new_suggestions.forEach((suggestion) => suggestions.add(suggestion));
            continue;
        }
        if (option.startsWith(text)) {
            suggestions.add(option);
        }
    }

    // if (repeatNode && suggestions.size === 1 && suggestions.has(null)) {
    if (repeatNode) {
        console.log('endings:', endings);
        for (const ending of endings) {
            let cropped_text = text.slice(ending.length);
            if (
                repeatNode.suffix &&
                (cropped_text === '' || !cropped_text.startsWith(repeatNode.suffix))
            ) {
                console.log('returning with suffix', repeatNode.suffix);
                return new Set<string | null>([repeatNode.suffix]);
            }
            repeatNode.suffix ??= '';
            cropped_text = cropped_text.slice(repeatNode.suffix.length).trim();
            console.log('repeating with text:', cropped_text, '@', repeatNode);
            const new_suggestions = genEsp(repeatNode, cropped_text);
            new_suggestions.forEach((suggestion) => suggestions.add(suggestion));
        }
        // return suggestions;
        // }

        // if (!text.startsWith(map.suffix) && (suggestions.has(null) || map.terminating) && map.suffix) {
        //     suggestions.add(map.suffix);
    }

    if (suggestions.size === 0) {
        suggestions.add(null);
    }

    console.log(text.length, `"${text}" s:`, suggestions);

    return suggestions;
}
