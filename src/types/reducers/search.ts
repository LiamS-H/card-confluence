import { ISearch } from '../interfaces/search/search';
import { IFilter } from '../interfaces/search/filter';
import { IComposition } from '../interfaces/search/composition';
import { ITrigger } from '../interfaces/search/trigger';

function triggerToString(trigger: ITrigger): string {
    return `[${trigger.source}:${trigger.event}]->[${trigger.destination}:${trigger.action}]`;
}

function filterToString(filter: IFilter): string {
    if (isNaN(parseFloat(filter.value))) {
        return `${filter.filter}${filter.operator}"${filter.value}"`;
    }
    return `${filter.filter}${filter.operator}${filter.value}`;
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
    return out.join(triggers.mode);
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

function genQueryString(searchObj: ISearch): string {
    const output: string[] = [];
    output.push('(game:paper)');
    output.push(filterCompToQuery(searchObj.domain));
    output.push(filterCompToQuery(searchObj.filters));
    triggerCompToQuery;
    // output.push('triggers:\n' + triggerCompToQuery(searchObj.triggers));

    return output.join(' ');
}

function genSearchObj(queryString: string): ISearch {
    queryString;
    const searchObj: ISearch = {
        domain: {
            name: 'Domain',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        filters: {
            name: 'Filters',
            type: 'composition',
            mode: 'and',
            components: [],
        },
        triggers: {
            name: 'Triggers',
            type: 'composition',
            mode: 'and',
            components: [],
        },
    };
    return searchObj;
}

export { genQueryString, genSearchObj };
