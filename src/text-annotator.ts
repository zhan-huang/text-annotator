import getSentences from './ext/sbd';

declare const window: any;

// div inside span is a bad idea
const blockElements: string[] = [
  'address',
  'article',
  'aside',
  'blockquote',
  'canvas',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'li',
  'main',
  'nav',
  'noscript',
  'ol',
  'output',
  'p',
  'pre',
  'section',
  'table',
  'tfoot',
  'ul',
  'video',
];

// interfaces for constructor
interface TAConstructorOptions {
  content: string;
  // isHTML is used to reduce the memory used: stripedHTML is empty if isHTML is false
  isHTML?: boolean;
}
interface TAConstructor {
  new (options: TAConstructorOptions): any;
}

// interfaces for public methods
interface TADirectSearchOptions {
  caseSensitive?: boolean;
  // encode is an experimental option; used for specific feature
  encode?: boolean;
  lastHighlightIndex?: number;
}
interface TAFuzzySearchOptions {
  caseSensitive?: boolean;
  // for token based fuzzy search
  tokenBased?: boolean;
  tbThreshold?: number;
  // for sentence based fuzzy search
  sentenceBased?: boolean;
  sbThreshold?: number;
  maxLengthDiff?: number;
  lenRatio?: number;
  processSentence(raw: string): string;
}
interface TAEagerSearchOptions {
  caseSensitive?: boolean;
  containerId: string;
  threshold?: number;
}
interface TASearchOptions {
  prefix?: string;
  postfix?: string;
  directSearchOptions?: TADirectSearchOptions;
  // fuzzy search is an experimental feature
  fuzzySearchOptions?: TAFuzzySearchOptions;
  // eager search is an experimental feature
  // eager search only works in (particular) browsers
  eagerSearchOptions?: TAEagerSearchOptions;
  trim?: boolean;
  caseSensitive?: boolean;
}
interface TAHighlightOptions {
  highlightClass?: string;
  highlightIdPattern?: string;
}
interface TASearchAndHighlightOptions {
  searchOptions?: TASearchOptions;
  highlightOptions?: TAHighlightOptions;
}
interface TAInstance {
  search(str: string, options?: TASearchOptions): number;
  // searchAll is an experimental feature
  // searchAll only supports direct search for now
  searchAll(str: string, options?: TASearchOptions): number[];
  highlight(highlightIndex: number, options?: TAHighlightOptions): string;
  // highlightAll is an experimental feature
  highlightAll(highlightIndexes: number[], options?: TAHighlightOptions): string;
  // can remove options
  unhighlight(highlightIndex: number, options?: TAHighlightOptions): string;
}

// interfaces/types for internal reusability
interface TrimmedResult {
  prefix: string;
  str: string;
  postfix: string;
}
type Location = [number, number];
interface BestString {
  similarity?: number;
  loc?: Location;
}
type TagLocation = [number, number, number];
interface Sentence {
  raw: string;
  index: number;
}
interface Highlight {
  highlighted?: boolean;
  loc: Location;
}

const TextAnnotator: TAConstructor = class TextAnnotator implements TAInstance {
  private originalContent: string;
  // annotatedContent is introduced in order to avoid passing content in the methods
  private annotatedContent: string;
  private isHTML: boolean;

  // stripedHTML and tagLocations are needed only when the content is HTML
  private stripedHTML: string;
  private tagLocations: TagLocation[];
  private sentences: Sentence[];
  private highlights: Highlight[];

  constructor({ content, isHTML = true }: TAConstructorOptions) {
    this.originalContent = this.annotatedContent = content;
    this.isHTML = isHTML;

    this.stripedHTML = '';
    this.tagLocations = [];
    // sentences are used in sentence-based fuzzy search
    this.sentences = [];
    // future work: one highlight can have more than one location because of the potential issue in tag insertion
    this.highlights = [];

    if (isHTML) {
      this.stripAndStoreHTMLTags();
    }
  }

  // the order of directSearch => fuzzy search => eager search is tailored for specific feature
  // search is now the default way of search but it can be customized via options
  // more customizations can be done by composing functions
  search(
    str: string,
    {
      prefix = '',
      postfix = '',
      directSearchOptions = {},
      fuzzySearchOptions,
      eagerSearchOptions,
      // trim by default
      trim = true,
      // caseSensitive can be overwritten by options of direct/fuzzy/eager search
      caseSensitive = false,
    }: TASearchOptions = {},
  ): number {
    if (trim) {
      const res: TrimmedResult = TextAnnotator.trim(prefix, str, postfix);
      prefix = res.prefix;
      str = res.str;
      postfix = res.postfix;
    }

    let highlightIndex = -1;

    // direct search will always be performed
    highlightIndex = this.directSearch(prefix, str, postfix, Object.assign({ caseSensitive }, directSearchOptions));
    if (highlightIndex !== -1) {
      return highlightIndex;
    }

    if (fuzzySearchOptions) {
      highlightIndex = this.fuzzySearch(prefix, str, postfix, Object.assign({ caseSensitive }, fuzzySearchOptions));
      if (highlightIndex !== -1) {
        return highlightIndex;
      }
    }

    if (eagerSearchOptions) {
      highlightIndex = this.eagerSearch(prefix, str, postfix, Object.assign({ caseSensitive }, eagerSearchOptions));
      if (highlightIndex !== -1) {
        return highlightIndex;
      }
    }

    return highlightIndex;
  }

  searchAll(str: string, options: TASearchOptions = {}): number[] {
    const highlightIndexes: number[] = [];

    const continueSearch = (str: string, options: TASearchOptions): void => {
      const highlightIndex: number = this.search(str, options);
      if (highlightIndex !== -1) {
        highlightIndexes.push(highlightIndex);
        options.directSearchOptions = options.directSearchOptions || {};
        options.directSearchOptions.lastHighlightIndex = highlightIndex;
        continueSearch(str, options);
      }
    };

    continueSearch(str, options);

    return highlightIndexes;
  }

  highlight(
    highlightIndex: number,
    { highlightClass = 'highlight', highlightIdPattern = 'highlight-' }: TAHighlightOptions = {},
  ): string {
    const openTag: string = TextAnnotator.createOpenTag(highlightIdPattern, highlightIndex, highlightClass);
    const loc: Location = this.adjustLoc(highlightIdPattern, highlightIndex, highlightClass);
    this.annotatedContent = TextAnnotator.insert(this.annotatedContent, openTag, loc[0]);
    this.annotatedContent = TextAnnotator.insert(
      this.annotatedContent,
      TextAnnotator.createCloseTag(),
      loc[1] + openTag.length,
    );
    // it has to be set after adjustLoc so that it will not be checked
    this.highlights[highlightIndex].highlighted = true;

    return this.annotatedContent;
  }

  highlightAll(highlightIndexes: number[], options: TAHighlightOptions = {}): string {
    for (let i = 0; i < highlightIndexes.length; i++) {
      this.annotatedContent = this.highlight(highlightIndexes[i], options);
    }
    return this.annotatedContent;
  }

  searchAndHighlight(str: string, { searchOptions, highlightOptions }: TASearchAndHighlightOptions = {}): any {
    const highlightIndex: number = this.search(str, searchOptions);
    if (highlightIndex !== -1) {
      return {
        highlightIndex,
        content: this.highlight(highlightIndex, highlightOptions),
      };
    }
  }

  unhighlight(
    highlightIndex: number,
    { highlightClass = 'highlight', highlightIdPattern = 'highlight-' }: TAHighlightOptions = {},
  ): string {
    // it has to be set before adjustLoc so that it will not be checked
    this.highlights[highlightIndex].highlighted = false;

    // need to change when one annotation => more than one highlight
    const loc: Location = this.adjustLoc(highlightIdPattern, highlightIndex, highlightClass);
    const openTagLength: number = TextAnnotator.getOpenTagLength(highlightIdPattern, highlightIndex, highlightClass);
    const substr1: string = this.annotatedContent.substring(
      loc[0],
      loc[1] + openTagLength + TextAnnotator.getCloseTagLength(),
    );
    const substr2: string = this.annotatedContent.substring(loc[0] + openTagLength, loc[1] + openTagLength);
    this.annotatedContent = this.annotatedContent.replace(substr1, substr2);

    return this.annotatedContent;
  }

  stripAndStoreHTMLTags(): void {
    let tag: any;
    this.stripedHTML = this.originalContent;
    const tagRegEx: any = /<[^>]+>/;
    let indexInc = 0;
    while ((tag = this.stripedHTML.match(tagRegEx))) {
      this.stripedHTML = this.stripedHTML.replace(tag, '');
      const tagLength: number = tag[0].length;
      // tagLocations will be used in adjustLoc
      this.tagLocations.push([tag.index, tagLength, indexInc]);
      indexInc += tagLength;
    }
  }

  directSearch(
    prefix: string,
    str: string,
    postfix: string,
    { caseSensitive = false, encode = false, lastHighlightIndex }: TADirectSearchOptions,
  ): number {
    let strWithFixes: string = prefix + str + postfix;
    let text: string = this.isHTML ? this.stripedHTML : this.originalContent;
    if (!caseSensitive) {
      strWithFixes = strWithFixes.toLowerCase();
      text = text.toLowerCase();
    }

    // for searchAll
    let offset = 0;
    if (lastHighlightIndex !== undefined) {
      offset = this.highlights[lastHighlightIndex].loc[1] + 1;
    }

    let highlightIndex = -1;
    const index: number = text.indexOf(strWithFixes, offset);
    // experimental feature: if the text to be searched does not work, try to encode it
    if (encode && index === -1) {
      // eslint-disable-next-line
      const Entities: any = require('html-entities').AllHtmlEntities;
      const entities: any = new Entities();
      const encodedStrWithFixes: string = entities.encode(strWithFixes);
      const index: number = text.indexOf(encodedStrWithFixes, offset);
      if (index !== -1) {
        const loc: Location = [0, 0];
        loc[0] = index + entities.encode(prefix).length;
        loc[1] = loc[0] + entities.encode(str).length;
        highlightIndex = this.highlights.push({ loc }) - 1;
      }
    } else if (index !== -1) {
      const loc: Location = [0, 0];
      loc[0] = index + prefix.length;
      loc[1] = loc[0] + str.length;
      highlightIndex = this.highlights.push({ loc }) - 1;
    }
    return highlightIndex;
  }

  eagerSearch(
    prefix: string,
    str: string,
    postfix: string,
    { caseSensitive = false, containerId, threshold = 0.74 }: TAEagerSearchOptions,
  ): number {
    const strWithFixes: string = prefix + str + postfix;

    let highlightIndex = -1;
    // IE is not considered
    if (window.find) {
      document.designMode = 'on';

      // step 1: ask the browser to highlight the found
      const sel: any = window.getSelection();
      sel.collapse(document.body, 0);
      while (window.find(strWithFixes, caseSensitive)) {
        document.execCommand('hiliteColor', true, 'rgba(255, 255, 255, 0)');
        sel.collapseToEnd();
        // step 2: locate the found within the container where the annotator is applied
        // selector may become better
        const found: any = document.querySelector(
          '#' + containerId + ' [style="background-color: rgba(255, 255, 255, 0);"]',
        );
        if (found) {
          const foundStr: string = found.innerHTML.replace(/<[^>]*>/g, '');
          const result: BestString = TextAnnotator.getBestSubstring(foundStr, str, threshold);
          if (result.similarity) {
            const text: string = this.isHTML ? this.stripedHTML : this.originalContent;
            const index: number = text.indexOf(foundStr);
            if (index !== -1) {
              highlightIndex =
                this.highlights.push({
                  loc: [index + result.loc[0], index + result.loc[1]],
                }) - 1;
            }
          }
          break;
        }
      }

      // step 3: remove the highlights created by the browser
      document.execCommand('undo');

      document.designMode = 'off';
    }
    return highlightIndex;
  }

  // sentence-based fuzzy search is enabled by default
  fuzzySearch(
    prefix: string,
    str: string,
    postfix: string,
    {
      caseSensitive,
      tokenBased,
      tbThreshold = 0.68,
      sentenceBased = true,
      sbThreshold = 0.85,
      maxLengthDiff = 0.1,
      lenRatio = 2,
      processSentence,
    }: TAFuzzySearchOptions,
  ): number {
    let highlightIndex = -1;
    const text: string = this.isHTML ? this.stripedHTML : this.originalContent;
    // token-based
    if (tokenBased || prefix || postfix) {
      // step 1: find all indexes of str
      const strIndexes: number[] = [];
      let i = -1;
      while ((i = text.indexOf(str, i + 1)) !== -1) {
        strIndexes.push(i);
      }

      // step 2: find the index of the most similar "fragment" - the str with pre- and post- fixes
      let strIndex = -1;
      const fragment: string = prefix + str + postfix;
      for (let i = 0; i < strIndexes.length; i++) {
        const si: number = strIndexes[i];
        // f can be wider
        const f: string =
          text.substring(si - prefix.length, si) +
          str +
          text.substring(si + str.length, si + str.length + postfix.length);
        const similarity: number = TextAnnotator.getSimilarity(f, fragment, caseSensitive);
        if (similarity >= tbThreshold) {
          tbThreshold = similarity;
          strIndex = si;
        }
      }

      // step 3: check whether the most similar enough "fragment" is found, if yes return its location
      if (strIndex !== -1) {
        highlightIndex = this.highlights.push({ loc: [strIndex, strIndex + str.length] }) - 1;
      }
    }
    // sentence-based
    else if (sentenceBased) {
      // step 1: sentenize the text if has not done so
      let sentences: Sentence[] = [];
      if (this.sentences.length) {
        sentences = this.sentences;
      } else {
        sentences = this.sentences = TextAnnotator.sentenize(text);
      }

      // step 2 (for efficiency only): filter sentences by words of the str
      const words: string[] = str.split(/\s/);
      const filteredSentences: Sentence[] = [];
      for (let i = 0; i < sentences.length; i++) {
        for (let j = 0; j < words.length; j++) {
          if (sentences[i].raw.includes(words[j])) {
            filteredSentences.push(sentences[i]);
            break;
          }
        }
      }

      //step 3 (optional)
      if (processSentence) {
        let index = 0;
        // for each sentence
        for (let i = 0; i < filteredSentences.length; i++) {
          const fs: Sentence = filteredSentences[i];
          let raw: string = fs.raw;
          // loc without tags
          const loc: Location = [fs.index, fs.index + raw.length];
          let locInc = 0;
          // add loc of all tags before the one being checked so as to derive the actual loc
          const tagLocations: TagLocation[] = this.tagLocations;
          // for each loc of tag whose loc is larger than the last sentence
          for (let j = index; j < tagLocations.length; j++) {
            const tagLoc: TagLocation = tagLocations[j];
            if (tagLoc[0] >= loc[0] && tagLoc[0] <= loc[1]) {
              const tag: string = this.originalContent.substring(
                tagLoc[0] + tagLoc[2],
                tagLoc[0] + tagLoc[2] + tagLoc[1],
              );
              const insertIndex: number = tagLoc[0] + locInc - loc[0];
              raw = raw.slice(0, insertIndex) + tag + raw.slice(insertIndex);
              locInc += tagLoc[1];
            } else if (tagLoc[0] > loc[1]) {
              index = j; // not sure this part
              break;
            }
          }

          raw = processSentence(raw);
          raw = raw.replace(/(<([^>]+)>)/gi, '');

          const copy: string = fs.raw;
          // update the sentence if it got reduced
          if (copy !== raw) {
            fs.raw = raw;
            fs.index = fs.index + copy.indexOf(raw);
          }
        }
      }

      // step 4: find the most possible sentence
      let mostPossibleSentence: Sentence = null;
      for (let i = 0; i < filteredSentences.length; i++) {
        const sentence: Sentence = filteredSentences[i];
        const similarity: number = TextAnnotator.getSimilarity(sentence.raw, str, caseSensitive);
        if (similarity >= sbThreshold) {
          sbThreshold = similarity;
          mostPossibleSentence = sentence;
        } else if (i !== filteredSentences.length - 1) {
          // combine two sentences to reduce the inaccuracy of sentenizing text
          const newSentenceRaw: string = sentence.raw + filteredSentences[i + 1].raw;
          const lengthDiff: number = Math.abs(newSentenceRaw.length - str.length) / str.length;
          if (lengthDiff <= maxLengthDiff) {
            const newSimilarity: number = TextAnnotator.getSimilarity(newSentenceRaw, str, caseSensitive);
            if (newSimilarity >= sbThreshold) {
              sbThreshold = newSimilarity;
              mostPossibleSentence = {
                raw: newSentenceRaw,
                index: sentence.index,
              };
            }
          }
        }
      }

      // step 5:  if the most possible sentence is found, derive and return the location of the most similar str from it
      if (mostPossibleSentence) {
        const result: BestString = TextAnnotator.getBestSubstring(
          mostPossibleSentence.raw,
          str,
          sbThreshold,
          lenRatio,
          caseSensitive,
          true,
        );
        if (result.loc) {
          const index: number = mostPossibleSentence.index;
          highlightIndex =
            this.highlights.push({
              loc: [index + result.loc[0], index + result.loc[1]],
            }) - 1;
        }
      }
    }
    return highlightIndex;
  }

  // future work: further improvement when one annotation binds with more than one highlight
  // includeRequiredTag used in = condition only
  includeRequiredTag(i: number, highlightLoc: Location, tag: string): boolean {
    const isCloseTag: boolean = tag.startsWith('</');
    const tagName: string = isCloseTag
      ? tag.split('</')[1].split('>')[0]
      : tag.split(' ')[0].split('<')[1].split('>')[0];

    let included = false;

    let requiredTagNumber = 1;
    let requiredTagCount = 0;
    // if both the start tag and the end tag are at the borders, place the tags outside the borders
    // if the close tag is at the border, check backwards until the start of the highlight
    if (isCloseTag) {
      for (let i2 = i - 1; i2 >= 0; i2--) {
        const tagLoc2: TagLocation = this.tagLocations[i2];
        if (highlightLoc[0] > tagLoc2[0]) {
          break;
        } else {
          const tag2: string = this.originalContent.substring(
            tagLoc2[0] + tagLoc2[2],
            tagLoc2[0] + tagLoc2[2] + tagLoc2[1],
          );
          if (tag2.startsWith('</' + tagName)) {
            requiredTagNumber++;
          } else if (tag2.startsWith('<' + tagName)) {
            requiredTagCount++;
          }
          if (requiredTagNumber === requiredTagCount) {
            included = true;
            break;
          }
        }
      }
    }
    // if the start tag is at the border, check forwards until the end of the highlight
    else {
      for (let i2 = i + 1; i2 < this.tagLocations.length; i2++) {
        const tagLoc2: TagLocation = this.tagLocations[i2];
        if (highlightLoc[1] < tagLoc2[0]) {
          break;
        } else {
          const tag2: string = this.originalContent.substring(
            tagLoc2[0] + tagLoc2[2],
            tagLoc2[0] + tagLoc2[2] + tagLoc2[1],
          );
          if (tag2.startsWith('<' + tagName)) {
            requiredTagNumber++;
          } else if (tag2.startsWith('</' + tagName)) {
            requiredTagCount++;
          }
          if (requiredTagNumber === requiredTagCount) {
            included = true;
            break;
          }
        }
      }
    }

    return included;
  }

  adjustLoc(highlightIdPattern: string, highlightIndex: number, highlightClass: string): Location {
    const highlightLoc: Location = this.highlights[highlightIndex].loc;
    const locInc: Location = [0, 0];

    // step 1: check locations of tags
    const length: number = this.tagLocations.length;
    for (let i = 0; i < length; i++) {
      const tagLoc: TagLocation = this.tagLocations[i];
      // start end tag
      if (highlightLoc[1] < tagLoc[0]) {
        break;
      }
      // start end&tag
      else if (highlightLoc[1] === tagLoc[0]) {
        const tag: string = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
        // if end tag, not block element and include the required close tag, add right to the tag
        if (
          !tag.endsWith('/>') &&
          tag.startsWith('</') &&
          !blockElements.includes(tag.split('</')[1].split('>')[0]) &&
          this.includeRequiredTag(i, highlightLoc, tag)
        ) {
          locInc[1] += tagLoc[1];
        }
      }
      // start tag end
      else if (highlightLoc[1] > tagLoc[0]) {
        locInc[1] += tagLoc[1];
        // start&tag end
        if (highlightLoc[0] === tagLoc[0]) {
          const tag: string = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
          // if self close tag or end tag or block element or not include the required close tag, add right to the tag
          if (
            tag.startsWith('</') ||
            tag.endsWith('/>') ||
            blockElements.includes(tag.split(' ')[0].split('<')[1].split('>')[0]) ||
            !this.includeRequiredTag(i, highlightLoc, tag)
          ) {
            locInc[0] += tagLoc[1];
          }
        }
        // tag start end
        else if (highlightLoc[0] > tagLoc[0]) {
          locInc[0] += tagLoc[1];
        }
      }
    }

    // step 2: check locations of other highlights
    // all span (no blocks)
    // stored in a different array than tags
    // can intersect
    for (let i = 0; i < this.highlights.length; i++) {
      const highlight: Highlight = this.highlights[i];
      // only check the highlighted
      if (highlight.highlighted) {
        const openTagLength: number = TextAnnotator.getOpenTagLength(highlightIdPattern, i, highlightClass);
        const closeTagLength: number = TextAnnotator.getCloseTagLength();
        const loc: Location = highlight.loc;
        if (highlightLoc[0] >= loc[1]) {
          locInc[0] += openTagLength + closeTagLength;
          locInc[1] += openTagLength + closeTagLength;
        }
        // syntactical correct but semantical incorrect
        else if (highlightLoc[0] < loc[1] && highlightLoc[0] > loc[0] && highlightLoc[1] > loc[1]) {
          locInc[0] += openTagLength;
          locInc[1] += openTagLength + closeTagLength;
        } else if (highlightLoc[0] <= loc[0] && highlightLoc[1] >= loc[1]) {
          locInc[1] += openTagLength + closeTagLength;
        }
        // syntactical correct but semantical incorrect
        else if (highlightLoc[0] < loc[0] && highlightLoc[1] > loc[0] && highlightLoc[1] < loc[1]) {
          locInc[1] += openTagLength;
        } else if (highlightLoc[0] >= loc[0] && highlightLoc[1] <= loc[1]) {
          locInc[0] += openTagLength;
          locInc[1] += openTagLength;
        }
      }
    }

    return [highlightLoc[0] + locInc[0], highlightLoc[1] + locInc[1]];
  }

  static createOpenTag(highlightIdPattern: string, highlightIndex: number, highlightClass: string): string {
    return `<span id="${highlightIdPattern + highlightIndex}" class="${highlightClass}">`;
  }

  static createCloseTag(): string {
    return `</span>`;
  }

  static getOpenTagLength(highlightIdPattern: string, highlightIndex: number, highlightClass: string): number {
    return TextAnnotator.createOpenTag(highlightIdPattern, highlightIndex, highlightClass).length;
  }

  static getCloseTagLength(): number {
    return TextAnnotator.createCloseTag().length;
  }

  static trim(prefix: string, str: string, postfix: string): TrimmedResult {
    prefix = prefix.replace(/^\s+/, '');
    postfix = postfix.replace(/\s+$/, '');
    if (!prefix) {
      str = str.replace(/^\s+/, '');
    }
    if (!postfix) {
      str = str.replace(/\s+$/, '');
    }

    return { prefix, str, postfix };
  }

  static insert(str1: string, str2: string, index: number): string {
    return str1.slice(0, index) + str2 + str1.slice(index);
  }

  static sentenize(text: string): Sentence[] {
    const options: any = {
      newline_boundaries: false,
      html_boundaries: false,
      sanitize: false,
      allowed_tags: false,
      preserve_whitespace: true,
      abbreviations: null,
    };
    return getSentences(text, options).map((raw: string) => {
      // future work: can tokenizer return location directly
      const index: number = text.indexOf(raw);
      return { raw, index };
    });
  }

  static getBestSubstring(
    str: string,
    substr: string,
    threshold: number,
    lenRatio?: number,
    caseSensitive?: boolean,
    skipFirstRun?: boolean,
  ): BestString {
    let result: any = {};

    let similarity: number = skipFirstRun ? threshold : TextAnnotator.getSimilarity(str, substr, caseSensitive);
    if (similarity >= threshold) {
      // step 1: derive best substr
      // future work: /s may be better
      const words: string[] = str.split(' ');
      while (words.length) {
        const firstWord: string = words.shift();
        const newStr: string = words.join(' ');
        let newSimilarity: number = TextAnnotator.getSimilarity(newStr, substr, caseSensitive);
        if (newSimilarity < similarity) {
          words.unshift(firstWord);
          const lastWord: string = words.pop();
          newSimilarity = TextAnnotator.getSimilarity(words.join(' '), substr, caseSensitive);
          if (newSimilarity < similarity) {
            words.push(lastWord);
            break;
          } else {
            similarity = newSimilarity;
          }
        } else {
          similarity = newSimilarity;
        }
      }
      const bestSubstr: string = words.join(' ');

      // step 2: return the best substr and its loc if found and if it meets the threshold and the length ratio
      if (!lenRatio || bestSubstr.length / substr.length <= lenRatio) {
        const loc: Location = [0, 0];
        loc[0] = str.indexOf(bestSubstr);
        loc[1] = loc[0] + bestSubstr.length;
        result = { similarity, loc };
      }
    }

    return result;
  }

  static getSimilarity(str1: string, str2: string, caseSensitive: boolean): number {
    if (!caseSensitive) {
      str1 = str1.toLowerCase();
      str2 = str2.toLowerCase();
    }
    if (str1 === str2) return 1;
    // set str2 to denominator
    return TextAnnotator.lcsLength(str1, str2) / str2.length;
  }

  // copy from the code in https://www.npmjs.com/package/longest-common-subsequence
  static lcsLength(firstSequence: string, secondSequence: string, caseSensitive?: boolean): number {
    function createArray(dimension: number): any[] {
      const array = [];

      for (let i = 0; i < dimension; i++) {
        array[i] = [];
      }

      return array;
    }

    const firstString: string = caseSensitive ? firstSequence : firstSequence.toLowerCase();
    const secondString: string = caseSensitive ? secondSequence : secondSequence.toLowerCase();

    if (firstString === secondString) {
      return firstString.length;
    }

    if ((firstString || secondString) === '') {
      return ''.length;
    }

    const firstStringLength: number = firstString.length;
    const secondStringLength: number = secondString.length;
    const lcsMatrix: any[] = createArray(secondStringLength + 1);

    let i: number;
    let j: number;
    for (i = 0; i <= firstStringLength; i++) {
      lcsMatrix[0][i] = 0;
    }

    for (i = 0; i <= secondStringLength; i++) {
      lcsMatrix[i][0] = 0;
    }

    for (i = 1; i <= secondStringLength; i++) {
      for (j = 1; j <= firstStringLength; j++) {
        if (firstString[j - 1] === secondString[i - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1;
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
        }
      }
    }

    let lcs = '';
    i = secondStringLength;
    j = firstStringLength;

    while (i > 0 && j > 0) {
      if (firstString[j - 1] === secondString[i - 1]) {
        lcs = firstString[j - 1] + lcs;
        i--;
        j--;
      } else if (Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]) === lcsMatrix[i - 1][j]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs.length;
  }
};

export default TextAnnotator;
