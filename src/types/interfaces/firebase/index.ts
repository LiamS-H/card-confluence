export interface CardColletion {
    tags: TagDocument;
}

export interface TagDocument {
    atags: string[];
    otags: string[];
    updatedAt?: Date;
}
