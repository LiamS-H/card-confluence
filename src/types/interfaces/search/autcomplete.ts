export type WordBank = (string | null)[];

export interface IMultiMap<NodeType> {
    keys: string[];
    node: NodeType;
}

export interface ISingleMap<NodeType> {
    [key: string]: NodeType;
}

export type IAutocompleteNode = IAutocompleteMap | WordBank | null;

export interface IAutocompleteMap {
    multimaps?: IMultiMap<IAutocompleteNode>[];
    singlemap?: ISingleMap<IAutocompleteNode>;
    wordbank?: string[];
    repeating?: true;
    forceUniqueRepeats?: true;
    terminating?: true;
    freesolo?: true;
    prefix?: string;
    suffix?: string;
}

export type IFastAutocompleteNode = IFastAutocompleteMap | null;

export interface IFastAutocompleteMap {
    sorted_options: string[];
    singlemap: ISingleMap<IFastAutocompleteNode>;
    repeating?: true;
    forceUniqueRepeats?: true;
    terminating?: true;
    freesolo?: true;
    prefix?: string;
    suffix?: string;
}
// fix scenario with non map words on oracle going infinite
// make it always return the current type segment so it can be colored as valid, or make empty list behave as if all is correct
// {b/g} incorrectly returns } and doesn't return {
