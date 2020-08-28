import getSentences from './ext/sbd'

// used to distinguish between browser and Node.js environments
// is it possible to relax so as to allow jsdom
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

// div inside span is a bad idea
const blockElements = [
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
  'video'
]

class TextAnnotator {
  constructor(options = {}) {
    // either containerId or content is required
    const containerId = options.containerId
    const content = options.content
    // isHTML is used to reduce the memory used: stripedHTML is empty if isHTML is false
    const isHTML = options.isHTML === undefined || options.isHTML

    // containerId has higher priority over content
    this.originalContent =
      isBrowser && containerId
        ? document.getElementById(containerId).innerHTML
        : content
    this.isHTML = isHTML

    // stripedHTML and tagLocations are needed only when the content is HTML
    this.stripedHTML = ''
    this.tagLocations = []
    // sentences are used in sentence-based fuzzy search
    this.sentences = []
    // future work: one highlight can have more than one location because of the potential issue in tag insertion
    this.highlights = []

    if (isHTML) {
      this.stripAndStoreHTMLTags()
    }
  }

  // lastHighlightIndex can be within options; it is currently used by searchAll
  search(str, options = {}, lastHighlightIndex) {
    let prefix = options.prefix || ''
    let postfix = options.postfix || ''
    const directSearchOptions = options.directSearchOptions
    const fuzzySearchOptions = options.fuzzySearchOptions
    const eagerSearchOptions = options.eagerSearchOptions
    // trim by default
    const trim = options.trim === undefined || options.trim

    if (trim) {
      const res = TextAnnotator.trim(prefix, str, postfix)
      prefix = res.prefix
      str = res.str
      postfix = res.postfix
    }

    let highlightIndex = -1

    // direct search will always be performed
    highlightIndex = this.directSearch(
      prefix,
      str,
      postfix,
      directSearchOptions,
      lastHighlightIndex
    )
    if (highlightIndex !== -1) {
      return highlightIndex
    }

    // experimental feature
    if (fuzzySearchOptions) {
      highlightIndex = this.fuzzySearch(
        prefix,
        str,
        postfix,
        fuzzySearchOptions
      )
      if (highlightIndex !== -1) {
        return highlightIndex
      }
    }

    // experimental feature
    // eager search only works in (particular) browsers
    if (isBrowser && eagerSearchOptions) {
      highlightIndex = this.eagerSearch(
        prefix,
        str,
        postfix,
        eagerSearchOptions
      )
      if (highlightIndex !== -1) {
        return highlightIndex
      }
    }

    return highlightIndex
  }

  // experimental feature
  // only support direct search for now
  searchAll(str, options = {}) {
    const highlightIndexes = []

    const continueSearch = (str, options, lastHighlightIndex) => {
      const highlightIndex = this.search(str, options, lastHighlightIndex)
      if (highlightIndex !== -1) {
        highlightIndexes.push(highlightIndex)
        continueSearch(str, options, highlightIndex)
      }
    }

    continueSearch(str, options)

    return highlightIndexes
  }

  highlight(highlightIndex, options = {}) {
    // either containerId or content is required
    const containerId = options.containerId
    let content = options.content
    const highlightClass = options.highlightClass || 'highlight'
    const highlightIdPattern = options.highlightIdPattern || 'highlight-'
    // if true, return the highlighted content instead of highlighting on the page directly
    const returnContent = options.returnContent

    if (isBrowser && containerId) {
      content = document.getElementById(containerId).innerHTML
    }

    const openTag = TextAnnotator.createOpenTag(
      highlightIdPattern,
      highlightIndex,
      highlightClass
    )
    const loc = this.adjustLoc(
      highlightIdPattern,
      highlightIndex,
      highlightClass
    )
    let newContent = TextAnnotator.insert(content, openTag, loc[0])
    newContent = TextAnnotator.insert(
      newContent,
      TextAnnotator.createCloseTag(),
      loc[1] + openTag.length
    )
    // it has to be set after adjustLoc so that it will not be checked
    this.highlights[highlightIndex].highlighted = true

    if (isBrowser && containerId && !returnContent) {
      document.getElementById(containerId).innerHTML = newContent
    } else {
      return newContent
    }
  }

  // experimental feature
  highlightAll(highlightIndexes, options = {}) {
    // either containerId or content is required
    const { containerId, content, returnContent } = options

    let newContent =
      isBrowser && containerId
        ? document.getElementById(containerId).innerHTML
        : content
    for (let i = 0; i < highlightIndexes.length; i++) {
      const newOptions = Object.assign({}, options)
      delete newOptions.containerId
      newOptions.content = newContent
      newOptions.returnContent = true
      newContent = this.highlight(highlightIndexes[i], newOptions)
    }

    if (isBrowser && containerId && !returnContent) {
      document.getElementById(containerId).innerHTML = newContent
    } else {
      return newContent
    }
  }

  searchAndHighlight(str, options) {
    const highlightIndex = this.search(str, options.searchOptions)
    if (highlightIndex !== -1) {
      // content is undefined if containerId and returnContent falsy
      return {
        highlightIndex,
        content: this.highlight(highlightIndex, options.highlightOptions)
      }
    }
  }

  unhighlight(highlightIndex, options = {}) {
    // byStringOperation is used to decide whether the content is changed by string operation or dom operation
    const byStringOperation = options.byStringOperation
    // either containerId or content is required
    const containerId = options.containerId
    let content = options.content
    const highlightClass = options.highlightClass || 'highlight'
    const highlightIdPattern = options.highlightIdPattern || 'highlight-'
    // if true, return the unhighlighted content instead of unhighlighting on the page directly
    const returnContent = options.returnContent

    // it has to be set before adjustLoc so that it will not be checked
    this.highlights[highlightIndex].highlighted = false

    if (byStringOperation) {
      if (isBrowser && containerId) {
        content = document.getElementById(containerId).innerHTML
      }

      let newContent = content
      // need to change when one annotation => more than one highlight
      const loc = this.adjustLoc(
        highlightIdPattern,
        highlightIndex,
        highlightClass
      )
      const openTagLength = TextAnnotator.getOpenTagLength(
        highlightIdPattern,
        highlightIndex,
        highlightClass
      )
      const substr1 = newContent.substring(
        loc[0],
        loc[1] + openTagLength + TextAnnotator.getCloseTagLength()
      )
      const substr2 = newContent.substring(
        loc[0] + openTagLength,
        loc[1] + openTagLength
      )
      newContent = newContent.replace(substr1, substr2)

      if (returnContent) {
        return newContent
      } else {
        document.getElementById(containerId).innerHTML = newContent
      }
    } else if (isBrowser) {
      const elmId = highlightIdPattern + highlightIndex
      document.getElementById(elmId).outerHTML = document.getElementById(
        elmId
      ).innerHTML
      if (returnContent) {
        return document.getElementById(containerId).innerHTML
      }
    }
  }

  stripAndStoreHTMLTags() {
    let tag
    this.stripedHTML = this.originalContent
    const tagRegEx = /<[^>]+>/
    let indexInc = 0
    while ((tag = this.stripedHTML.match(tagRegEx))) {
      this.stripedHTML = this.stripedHTML.replace(tag, '')
      const tagLength = tag[0].length
      // tagLocations will be used in adjustLoc
      this.tagLocations.push([tag.index, tagLength, indexInc])
      indexInc += tagLength
    }
  }

  directSearch(
    prefix,
    str,
    postfix,
    directSearchOptions = {},
    lastHighlightIndex
  ) {
    const caseSensitive = directSearchOptions.caseSensitive

    let strWithFixes = prefix + str + postfix
    let text = this.isHTML ? this.stripedHTML : this.originalContent
    if (!caseSensitive) {
      strWithFixes = strWithFixes.toLowerCase()
      text = text.toLowerCase()
    }

    // for searchAll
    let offset = 0
    if (lastHighlightIndex !== undefined) {
      offset = this.highlights[lastHighlightIndex].loc[1] + 1
    }

    let highlightIndex = -1
    const index = text.indexOf(strWithFixes, offset)
    if (index !== -1) {
      const loc = []
      loc[0] = index + prefix.length
      loc[1] = loc[0] + str.length
      highlightIndex = this.highlights.push({ loc }) - 1
    }
    return highlightIndex
  }

  eagerSearch(prefix, str, postfix, eagerSearchOptions = {}) {
    const caseSensitive = eagerSearchOptions.caseSensitive
    const containerId = eagerSearchOptions.containerId
    const threshold = eagerSearchOptions.threshold || 0.74

    const strWithFixes = prefix + str + postfix

    let highlightIndex = -1
    // IE is not considered
    if (window.find) {
      document.designMode = 'on'

      // step 1: ask the browser to highlight the found
      const sel = window.getSelection()
      sel.collapse(document.body, 0)
      while (window.find(strWithFixes, caseSensitive)) {
        document.execCommand('hiliteColor', true, 'rgba(255, 255, 255, 0)')
        sel.collapseToEnd()
        // step 2: locate the found within the container where the annotator is applied
        // selector may become better
        const found = document.querySelector(
          '#' +
            containerId +
            ' [style="background-color: rgba(255, 255, 255, 0);"]'
        )
        if (found) {
          const foundStr = found.innerHTML.replace(/<[^>]*>/g, '')
          const result = TextAnnotator.getBestSubstring(
            foundStr,
            str,
            threshold
          )
          if (result.similarity) {
            const text = this.isHTML ? this.stripedHTML : this.originalContent
            const index = text.indexOf(foundStr)
            if (index !== -1) {
              highlightIndex =
                this.highlights.push({
                  loc: [index + result.loc[0], index + result.loc[1]]
                }) - 1
            }
          }
          break
        }
      }

      // step 3: remove the highlights created by the browser
      document.execCommand('undo')

      document.designMode = 'off'
    }
    return highlightIndex
  }

  fuzzySearch(prefix, str, postfix, fuzzySearchOptions = {}) {
    const caseSensitive = fuzzySearchOptions.caseSensitive

    const tokenBased = fuzzySearchOptions.tokenBased
    let tbThreshold = fuzzySearchOptions.tbThreshold || 0.68

    // sentence-based fuzzy search is enabled by default
    const sentenceBased =
      fuzzySearchOptions.sentenceBased === undefined ||
      fuzzySearchOptions.sentenceBased
    let sbThreshold = fuzzySearchOptions.sbThreshold || 0.85
    const maxLengthDiff = fuzzySearchOptions.maxLengthDiff || 0.1
    const lenRatio = fuzzySearchOptions.lenRatio || 2
    const processSentence = fuzzySearchOptions.processSentence

    let highlightIndex = -1
    const text = this.isHTML ? this.stripedHTML : this.originalContent
    // token-based
    if (tokenBased || prefix || postfix) {
      // step 1: find all indexes of str
      const strIndexes = []
      let i = -1
      while ((i = text.indexOf(str, i + 1)) !== -1) {
        strIndexes.push(i)
      }

      // step 2: find the index of the most similar "fragment" - the str with pre- and post- fixes
      let strIndex = -1
      const fragment = prefix + str + postfix
      for (let i = 0; i < strIndexes.length; i++) {
        const si = strIndexes[i]
        // f can be wider
        const f =
          text.substring(si - prefix.length, si) +
          str +
          text.substring(si + str.length, si + str.length + postfix.length)
        const similarity = TextAnnotator.getSimilarity(
          f,
          fragment,
          caseSensitive
        )
        if (similarity >= tbThreshold) {
          tbThreshold = similarity
          strIndex = si
        }
      }

      // step 3: check whether the most similar enough "fragment" is found, if yes return its location
      if (strIndex !== -1) {
        highlightIndex =
          this.highlights.push({ loc: [strIndex, strIndex + str.length] }) - 1
      }
    }
    // sentence-based
    else if (sentenceBased) {
      // step 1: sentenize the text if has not done so
      let sentences = []
      if (this.sentences.length) {
        sentences = this.sentences
      } else {
        sentences = this.sentences = TextAnnotator.sentenize(text)
      }

      // step 2 (for efficiency only): filter sentences by words of the str
      const words = str.split(/\s/)
      const filteredSentences = []
      for (let i = 0; i < sentences.length; i++) {
        for (let j = 0; j < words.length; j++) {
          if (sentences[i].raw.includes(words[j])) {
            filteredSentences.push(sentences[i])
            break
          }
        }
      }

      //step 3 (optional)
      if (processSentence) {
        let index = 0
        // for each sentence
        for (let i = 0; i < filteredSentences.length; i++) {
          const fs = filteredSentences[i]
          let raw = fs.raw
          // loc without tags
          const loc = [fs.index, fs.index + raw.length]
          let locInc = 0
          // add loc of all tags before the one being checked so as to derive the actual loc
          const tagLocations = this.tagLocations
          // for each loc of tag whose loc is larger than the last sentence
          for (let j = index; j < tagLocations.length; j++) {
            const tagLoc = tagLocations[j]
            if (tagLoc[0] >= loc[0] && tagLoc[0] <= loc[1]) {
              const tag = this.originalContent.substring(
                tagLoc[0] + tagLoc[2],
                tagLoc[0] + tagLoc[2] + tagLoc[1]
              )
              const insertIndex = tagLoc[0] + locInc - loc[0]
              raw = raw.slice(0, insertIndex) + tag + raw.slice(insertIndex)
              locInc += tagLoc[1]
            } else if (tagLoc[0] > loc[1]) {
              index = j // not sure this part
              break
            }
          }

          raw = processSentence(raw)
          raw = raw.replace(/(<([^>]+)>)/gi, '')

          const copy = fs.raw
          // update the sentence if it got reduced
          if (copy !== raw) {
            fs.raw = raw
            fs.index = fs.index + copy.indexOf(raw)
          }
        }
      }

      // // step 4: find the sentence that includes the most similar str
      // let bestResult = null
      // let mostPossibleSentence = null
      // filteredSentences.forEach((sentence, index) => {
      //   let result = TextAnnotator.getBestSubstring(
      //     sentence.raw,
      //     str,
      //     sbThreshold,
      //     lenRatio,
      //     caseSensitive
      //   )
      //   if (result.similarity) {
      //     sbThreshold = result.similarity
      //     bestResult = result
      //     mostPossibleSentence = sentence
      //   } else if (index !== filteredSentences.length - 1) {
      //     // combine two sentences to reduce the inaccuracy of sentenizing text
      //     result = TextAnnotator.getBestSubstring(
      //       sentence.raw + filteredSentences[index + 1].raw,
      //       str,
      //       sbThreshold,
      //       lenRatio,
      //       caseSensitive
      //     )
      //     if (result.similarity) {
      //       sbThreshold = result.similarity
      //       bestResult = result
      //       mostPossibleSentence = filteredSentences[index]
      //     }
      //   }
      // })

      // // step 5: if such sentence is found, derive and return the location of the most similar str
      // if (bestResult) {
      //   let index = mostPossibleSentence.index
      //   highlightIndex =
      //     this.highlights.push({
      //       loc: [index + bestResult.loc[0], index + bestResult.loc[1]]
      //     }) - 1
      // }

      // step 4: find the most possible sentence
      let mostPossibleSentence = null
      for (let i = 0; i < filteredSentences.length; i++) {
        const sentence = filteredSentences[i]
        const similarity = TextAnnotator.getSimilarity(
          sentence.raw,
          str,
          caseSensitive
        )
        if (similarity >= sbThreshold) {
          sbThreshold = similarity
          mostPossibleSentence = sentence
        } else if (i !== filteredSentences.length - 1) {
          // combine two sentences to reduce the inaccuracy of sentenizing text
          const newSentenceRaw = sentence.raw + filteredSentences[i + 1].raw
          const lengthDiff =
            Math.abs(newSentenceRaw.length - str.length) / str.length
          if (lengthDiff <= maxLengthDiff) {
            const newSimilarity = TextAnnotator.getSimilarity(
              newSentenceRaw,
              str,
              caseSensitive
            )
            if (newSimilarity >= sbThreshold) {
              sbThreshold = newSimilarity
              mostPossibleSentence = {
                raw: newSentenceRaw,
                index: sentence.index
              }
            }
          }
        }
      }

      // step 5:  if the most possible sentence is found, derive and return the location of the most similar str from it
      if (mostPossibleSentence) {
        const result = TextAnnotator.getBestSubstring(
          mostPossibleSentence.raw,
          str,
          sbThreshold,
          lenRatio,
          caseSensitive,
          true
        )
        if (result.loc) {
          let index = mostPossibleSentence.index
          highlightIndex =
            this.highlights.push({
              loc: [index + result.loc[0], index + result.loc[1]]
            }) - 1
        }
      }
    }
    return highlightIndex
  }

  // future work: further improvement when one annotation binds with more than one highlight
  // includeRequiredTag used in = condition only
  includeRequiredTag(i, highlightLoc, tag) {
    const isCloseTag = tag.startsWith('</')
    const tagName = isCloseTag
      ? tag.split('</')[1].split('>')[0]
      : tag
          .split(' ')[0]
          .split('<')[1]
          .split('>')[0]

    let included = false

    let requiredTagNumber = 1
    let requiredTagCount = 0
    // if both the start tag and the end tag are at the borders, place the tags outside the borders
    // if the close tag is at the border, check backwards until the start of the highlight
    if (isCloseTag) {
      for (let i2 = i - 1; i2 >= 0; i2--) {
        const tagLoc2 = this.tagLocations[i2]
        if (highlightLoc[0] > tagLoc2[0]) {
          break
        } else {
          const tag2 = this.originalContent.substring(
            tagLoc2[0] + tagLoc2[2],
            tagLoc2[0] + tagLoc2[2] + tagLoc2[1]
          )
          if (tag2.startsWith('</' + tagName)) {
            requiredTagNumber++
          } else if (tag2.startsWith('<' + tagName)) {
            requiredTagCount++
          }
          if (requiredTagNumber === requiredTagCount) {
            included = true
            break
          }
        }
      }
    }
    // if the start tag is at the border, check forwards until the end of the highlight
    else {
      for (let i2 = i + 1; i2 < this.tagLocations.length; i2++) {
        const tagLoc2 = this.tagLocations[i2]
        if (highlightLoc[1] < tagLoc2[0]) {
          break
        } else {
          const tag2 = this.originalContent.substring(
            tagLoc2[0] + tagLoc2[2],
            tagLoc2[0] + tagLoc2[2] + tagLoc2[1]
          )
          if (tag2.startsWith('<' + tagName)) {
            requiredTagNumber++
          } else if (tag2.startsWith('</' + tagName)) {
            requiredTagCount++
          }
          if (requiredTagNumber === requiredTagCount) {
            included = true
            break
          }
        }
      }
    }

    return included
  }

  adjustLoc(highlightIdPattern, highlightIndex, highlightClass) {
    const highlightLoc = this.highlights[highlightIndex].loc
    const locInc = [0, 0]

    // step 1: check locations of tags
    const length = this.tagLocations.length
    for (let i = 0; i < length; i++) {
      const tagLoc = this.tagLocations[i]
      // start end tag
      if (highlightLoc[1] < tagLoc[0]) {
        break
      }
      // start end&tag
      else if (highlightLoc[1] === tagLoc[0]) {
        const tag = this.originalContent.substring(
          tagLoc[0] + tagLoc[2],
          tagLoc[0] + tagLoc[2] + tagLoc[1]
        )
        // if end tag, not block element and include the required close tag, add right to the tag
        if (
          !tag.endsWith('/>') &&
          tag.startsWith('</') &&
          !blockElements.includes(tag.split('</')[1].split('>')[0]) &&
          this.includeRequiredTag(i, highlightLoc, tag)
        ) {
          locInc[1] += tagLoc[1]
        }
      }
      // start tag end
      else if (highlightLoc[1] > tagLoc[0]) {
        locInc[1] += tagLoc[1]
        // start&tag end
        if (highlightLoc[0] === tagLoc[0]) {
          const tag = this.originalContent.substring(
            tagLoc[0] + tagLoc[2],
            tagLoc[0] + tagLoc[2] + tagLoc[1]
          )
          // if self close tag or end tag or block element or not include the required close tag, add right to the tag
          if (
            tag.startsWith('</') ||
            tag.endsWith('/>') ||
            blockElements.includes(
              tag
                .split(' ')[0]
                .split('<')[1]
                .split('>')[0]
            ) ||
            !this.includeRequiredTag(i, highlightLoc, tag)
          ) {
            locInc[0] += tagLoc[1]
          }
        }
        // tag start end
        else if (highlightLoc[0] > tagLoc[0]) {
          locInc[0] += tagLoc[1]
        }
      }
    }

    // step 2: check locations of other highlights
    // all span (no blocks)
    // stored in a different array than tags
    // can intersect
    for (let i = 0; i < this.highlights.length; i++) {
      const highlight = this.highlights[i]
      // only check the highlighted
      if (highlight.highlighted) {
        const openTagLength = TextAnnotator.getOpenTagLength(
          highlightIdPattern,
          i,
          highlightClass
        )
        const closeTagLength = TextAnnotator.getCloseTagLength()
        const loc = highlight.loc
        if (highlightLoc[0] >= loc[1]) {
          locInc[0] += openTagLength + closeTagLength
          locInc[1] += openTagLength + closeTagLength
        }
        // syntactical correct but semantical incorrect
        else if (
          highlightLoc[0] < loc[1] &&
          highlightLoc[0] > loc[0] &&
          highlightLoc[1] > loc[1]
        ) {
          locInc[0] += openTagLength
          locInc[1] += openTagLength + closeTagLength
        } else if (highlightLoc[0] <= loc[0] && highlightLoc[1] >= loc[1]) {
          locInc[1] += openTagLength + closeTagLength
        }
        // syntactical correct but semantical incorrect
        else if (
          highlightLoc[0] < loc[0] &&
          highlightLoc[1] > loc[0] &&
          highlightLoc[1] < loc[1]
        ) {
          locInc[1] += openTagLength
        } else if (highlightLoc[0] >= loc[0] && highlightLoc[1] <= loc[1]) {
          locInc[0] += openTagLength
          locInc[1] += openTagLength
        }
      }
    }

    return [highlightLoc[0] + locInc[0], highlightLoc[1] + locInc[1]]
  }

  static createOpenTag(highlightIdPattern, highlightIndex, highlightClass) {
    return `<span id="${highlightIdPattern +
      highlightIndex}" class="${highlightClass}">`
  }

  static createCloseTag() {
    return `</span>`
  }

  static getOpenTagLength(highlightIdPattern, highlightIndex, highlightClass) {
    return TextAnnotator.createOpenTag(
      highlightIdPattern,
      highlightIndex,
      highlightClass
    ).length
  }

  static getCloseTagLength() {
    return TextAnnotator.createCloseTag().length
  }

  static trim(prefix, str, postfix) {
    prefix = prefix.replace(/^\s+/, '')
    postfix = postfix.replace(/\s+$/, '')
    if (!prefix) {
      str = str.replace(/^\s+/, '')
    }
    if (!postfix) {
      str = str.replace(/\s+$/, '')
    }

    return { prefix, str, postfix }
  }

  static insert(str1, str2, index) {
    return str1.slice(0, index) + str2 + str1.slice(index)
  }

  static sentenize(text) {
    const options = {
      newline_boundaries: false,
      html_boundaries: false,
      sanitize: false,
      allowed_tags: false,
      preserve_whitespace: true,
      abbreviations: null
    }
    return getSentences(text, options).map(raw => {
      // future work: can tokenizer return location directly
      const index = text.indexOf(raw)
      return { raw, index }
    })
  }

  static getBestSubstring(
    str,
    substr,
    threshold,
    lenRatio,
    caseSensitive,
    skipFirstRun
  ) {
    let result = {}

    let similarity = skipFirstRun
      ? threshold
      : TextAnnotator.getSimilarity(str, substr, caseSensitive)
    if (similarity >= threshold) {
      // step 1: derive best substr
      // future work: /s may be better
      const words = str.split(' ')
      while (words.length) {
        const firstWord = words.shift()
        const newStr = words.join(' ')
        let newSimilarity = TextAnnotator.getSimilarity(
          newStr,
          substr,
          caseSensitive
        )
        if (newSimilarity < similarity) {
          words.unshift(firstWord)
          const lastWord = words.pop()
          newSimilarity = TextAnnotator.getSimilarity(
            words.join(' '),
            substr,
            caseSensitive
          )
          if (newSimilarity < similarity) {
            words.push(lastWord)
            break
          } else {
            similarity = newSimilarity
          }
        } else {
          similarity = newSimilarity
        }
      }
      const bestSubstr = words.join(' ')

      // step 2: return the best substr and its loc if found and if it meets the threshold and the length ratio
      if (!lenRatio || bestSubstr.length / substr.length <= lenRatio) {
        const loc = []
        loc[0] = str.indexOf(bestSubstr)
        loc[1] = loc[0] + bestSubstr.length
        result = { similarity, loc }
      }
    }

    return result
  }

  static getSimilarity(str1, str2, caseSensitive) {
    if (!caseSensitive) {
      str1 = str1.toLowerCase()
      str2 = str2.toLowerCase()
    }
    if (str1 === str2) return 1
    // set str2 to denominator
    return TextAnnotator.lcsLength(str1, str2) / str2.length
  }

  // copy from the code in https://www.npmjs.com/package/longest-common-subsequence
  static lcsLength(firstSequence, secondSequence, caseSensitive) {
    function createArray(dimension) {
      var array = []

      for (var i = 0; i < dimension; i++) {
        array[i] = []
      }

      return array
    }

    var firstString = caseSensitive
      ? firstSequence
      : firstSequence.toLowerCase()
    var secondString = caseSensitive
      ? secondSequence
      : secondSequence.toLowerCase()

    if (firstString === secondString) {
      return firstString
    }

    if ((firstString || secondString) === '') {
      return ''
    }

    var firstStringLength = firstString.length
    var secondStringLength = secondString.length
    var lcsMatrix = createArray(secondStringLength + 1)

    var i
    var j
    for (i = 0; i <= firstStringLength; i++) {
      lcsMatrix[0][i] = 0
    }

    for (i = 0; i <= secondStringLength; i++) {
      lcsMatrix[i][0] = 0
    }

    for (i = 1; i <= secondStringLength; i++) {
      for (j = 1; j <= firstStringLength; j++) {
        if (firstString[j - 1] === secondString[i - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1])
        }
      }
    }

    var lcs = ''
    i = secondStringLength
    j = firstStringLength

    while (i > 0 && j > 0) {
      if (firstString[j - 1] === secondString[i - 1]) {
        lcs = firstString[j - 1] + lcs
        i--
        j--
      } else if (
        Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]) ===
        lcsMatrix[i - 1][j]
      ) {
        i--
      } else {
        j--
      }
    }

    return lcs.length
  }
}

export default TextAnnotator
