interface IAutocompleteMap {
    tree?: { [key: string]: string[] | IAutocompleteMap };
    freeSolo?: boolean;
    wordbank?: string[] | IAutocompleteMap;
}

export type { IAutocompleteMap };
