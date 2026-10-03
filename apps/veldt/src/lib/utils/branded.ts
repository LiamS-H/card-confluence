export type Branded<T, BrandName> = T & { readonly __brand: BrandName };
