import { ISearch } from '../interfaces/search/search';
import { IFilter, isOperator, operators } from '../interfaces/search/filter';
import { CompositionMode, IComposition } from '../interfaces/search/composition';
import { ITrigger } from '../interfaces/search/trigger';

function triggerToString(trigger: ITrigger): string {
    return `[${trigger.source}:${trigger.event}]->[${trigger.destination}:${trigger.action}]`;
}

function filterToString(filter: IFilter): string {
    if (filter.value.includes(' ')) {
        return `${filter.filter}${filter.operator}"${filter.value}"`;
    }
    if (!isNaN(parseFloat(filter.value))) {
    }
    return `${filter.filter}${filter.operator}${filter.value}`;
}

function stringToFilter(filter_str: string): IFilter {
    const regex = new RegExp(
        `(.*?)(${operators.map((o) => (o === ':' ? '\\:' : o)).join('|')})(.*)`,
    );
    const match = filter_str.match(regex);

    if (!match || match.length < 4) throw Error('invalid filter str');
    const f = match[1].trim();
    const o = match[2].trim();
    const v = match[3].trim().replace(/^"|"$/g, '');

    if (!isOperator(o)) throw Error('invalid operator');

    const filter: IFilter = {
        type: 'filter',
        filter: f,
        operator: o,
        value: v,
    };

    return filter;
}

function triggerCompToQuery(triggers: IComposition<ITrigger>): string {
    const out: string[] = [];
    for (const trigger of triggers.components) {
        if (trigger.type == 'trigger') {
            out.push(triggerToString(trigger));
            continue;
        }
        if (trigger.type == 'composition') {
            out.push(triggerCompToQuery(trigger));
            continue;
        }
    }
    switch (triggers.mode) {
        case 'not': {
            return '-(' + out.join(' ') + ')';
        }
        case 'or': {
            return '(' + out.join(' or ') + ')';
        }
        default: {
            return '(' + out.join(' ') + ')';
        }
    }
}

function filterCompToQuery(filters: IComposition<IFilter>): string {
    const out: string[] = [];
    for (const filter of filters.components) {
        if (filter.type == 'filter') {
            out.push(filterToString(filter));
            continue;
        }
        if (filter.type == 'composition') {
            out.push(filterCompToQuery(filter));
            continue;
        }
    }
    switch (filters.mode) {
        case 'not': {
            return '-(' + out.join(' ') + ')';
        }
        case 'or': {
            return '(' + out.join(' or ') + ')';
        }
        default: {
            return '(' + out.join(' ') + ')';
        }
    }
}

const match_inside_comp_regex =
    /(?:-?\((?:[^()]|\((?:[^()]|\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))*\))*\))|(?:-?\w+(?:<=|>=|>|<|=|\:)(?:"[^"]*"|'[^']*'|\([^)]*\)|[^\s()]+))/g;

function queryToFilterComp(filters_str: string, id?: string): IComposition<IFilter> {
    id ??= '1';
    const match = filters_str.match(/(.*?)(\()(.*)(\))(.*)/);
    if (!match || match.length < 6) throw Error('invalid filter str');
    // if (match[5]) throw Error(`invalid text after filter @${match[5]}`);
    if (match[1] !== '-' && match[1] !== '') throw Error(`invalid filter modifier @${match[1]}`);

    const inner_str = match[3];

    const matches = inner_str.match(match_inside_comp_regex);
    let mode: CompositionMode = 'and';
    if (filters_str.startsWith('-(')) {
        mode = 'not';
    } else if (filters_str.match(/or/i)) {
        mode = 'or';
    }

    if (!matches) {
        return {
            name: 'unnamed composition',
            id: id,
            type: 'composition',
            mode: mode,
            components: [],
        };
    }
    const compositions: (IComposition<IFilter> | IFilter)[] = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const filter_str = match.trim();
        if (!filter_str.endsWith(')')) {
            compositions.push(stringToFilter(filter_str));
            continue;
        }
        compositions.push(queryToFilterComp(filter_str, id + i));
    }

    return {
        name: 'unnamed composition',
        id: id,
        type: 'composition',
        mode: mode,
        components: compositions,
    };
}

function genQueryString(searchObj: ISearch): string {
    const output: string[] = [];
    output.push(filterCompToQuery(searchObj.domain));
    output.push(filterCompToQuery(searchObj.filters));
    output.push(triggerCompToQuery(searchObj.triggers));
    output.push(`order:${searchObj.order}`);
    if (searchObj.direction != 'auto') output.push(`direction:${searchObj.direction}`);
    if (searchObj.order == 'release' && searchObj.printing == 'auto') {
        if (searchObj.direction != 'asc') output.push('prefer:newest');
        if (searchObj.direction == 'asc') output.push('prefer:oldest');
    }
    switch (searchObj.printing) {
        case 'unique':
            output.push(`unique:prints`);
            break;
        case 'newest':
        case 'oldest':
            output.push(`prefer:${searchObj.printing}`);
            break;
        default:
    }

    return output.join(' ');
}

function genSearchObj(queryString: string): ISearch {
    const searchObj: ISearch = {
        domain: {
            id: 'domain',
            name: 'Domain',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        filters: {
            id: 'filters',
            name: 'Filters',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        triggers: {
            id: 'triggers',
            name: 'Triggers',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        order: 'cmc',
        direction: 'auto',
        printing: 'auto',
    };

    const matches = queryString.match(match_inside_comp_regex);
    if (!matches) throw new Error('invalid query string');

    if (matches?.length < 3) {
        throw new Error('query string missing arguments');
    }
    const [domain_comps, filter_comps, trigger_comps, order] = matches.map((m) =>
        queryToFilterComp(m),
    );
    searchObj.domain.components = domain_comps.components;
    searchObj.filters.components = filter_comps.components;

    return searchObj;
}

export { genQueryString, genSearchObj, queryToFilterComp, filterToString };
