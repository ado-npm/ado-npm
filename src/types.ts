export type Expand<T> = any extends any ? { [P in keyof T]: T[P] } : never;
