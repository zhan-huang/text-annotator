export type ConstructorOptions = {
  content: string,
  isHTML?: boolean
}

export type DirectSearchOptions = {
  caseSensitive?: boolean,
  encode?: boolean,
  lastHighlightIndex?: number
}

export type FuzzySearchOptions = {
  caseSensitive?: boolean,
  tokenBased?: boolean,
  tbThreshold?: number,
  sentenceBased?: boolean,
  sbThreshold?: number,
  maxLengthDiff?: number,
  lenRatio?: number,
  processSentence?: (raw: string) => string
}

export type EagerSearchOptions = {
  caseSensitive?: boolean,
  containerId: string,
  threshold?: number
}

export type SearchOptions = {
  prefix?: string,
  postfix?: string,
  directSearchOptions?: DirectSearchOptions,
  fuzzySearchOptions?: FuzzySearchOptions,
  eagerSearchOptions?: EagerSearchOptions,
  trim?: boolean,
  caseSensitive?: boolean
}

export type HighlightOptions = {
  highlightTagName?: string,
  highlightClass?: string,
  highlightIdPattern?: string
}

export type Tag = [number, number, number]

export type Sentence = {
  raw: string,
  index: number
}

export type Location = [number, number]

export type Highlight = {
  highlighted?: boolean
  loc: Location
}
