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
    prefix?: string;
    suffix?: string;
}
