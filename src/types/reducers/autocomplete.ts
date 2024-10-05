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
function match(wordbank: string[], text: string): string[] {
    const start = Math.max(stringBSearch(wordbank, text) - 1, 0);
    const end = stringBSearch(wordbank, text + String.fromCodePoint(0x10ffff));
    return wordbank.slice(start, end);
}
export function genEsp(map: IFastAutocompleteMap, text: string): string[] {
    console.log('call map:', map);
    const og_text = text;

    //handle prefix

    //dead end
    if (map.sorted_options.length == 0) {
        return [];
    }

    const esp_list: string[] = [];
    if (map.terminating && map.suffix) {
        esp_list.push(map.suffix);
    }

    if (map.prefix) {
        if (!text.startsWith(map.prefix)) return [map.prefix];
        text = text.slice(map.prefix.length);
    }
    if (text !== '' && map.prefix) return [map.prefix];

    const options = match(map.sorted_options, text);
    console.log(text.length, `"${og_text}" o:`, options);

    if (text === '') {
        options.push.apply(options, esp_list);
        console.log('exiting', options);
        return options;
    }

    for (const option of options) {
        if (text.startsWith(option)) {
            const new_map = map.singlemap[option];
            if (!new_map) return map.suffix ? [map.suffix] : [];
            esp_list.push.apply(esp_list, genEsp(new_map, text.slice(option.length)));
        }
        if (option.startsWith(text)) {
            esp_list.push(option);
        }
    }
    console.log(text.length, `"${og_text}" e:`, esp_list);

    return esp_list;
}
