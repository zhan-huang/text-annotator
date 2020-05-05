import getSentences from './ext/sbd'

// used to distinguish between browser and Node.js environments
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

class TextAnnotator {
  constructor(options = {}) {
    // either containerId or content is required
    const containerId = options.containerId
    const content = options.content
    const isHTML = options.isHTML === undefined || options.isHTML

    // containerId has higher priority over content
    this.originalContent =
      isBrowser && containerId
        ? document.getElementById(containerId).innerHTML
        : content
    // isHTML is used to reduce the memory used: stripedHTML is empty if isHTML is false
    this.isHTML = isHTML

    // stripedHTML and tagLocations are needed only when the content is HTML
    this.stripedHTML = ''
    this.tagLocations = []
    // sentences are used in (sentence based) fuzzy search
    this.sentences = []
    // one highlight can have more than one location because of the potential issue in tag insertion***
    this.highlights = []

    if (isHTML) {
      this.stripAndStoreHTMLTags()
    }
  }

  // lastHighlightIndex can be within options***
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

  // only support directly search for now***
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
    this.highlights[highlightIndex].highlighted = true

    if (isBrowser && containerId && !returnContent) {
      document.getElementById(containerId).innerHTML = newContent
    } else {
      return newContent
    }
  }

  highlightAll(highlightIndexes, options = {}) {
    // either containerId or content is required
    const { containerId, content, returnContent } = options

    let newContent =
      isBrowser && containerId
        ? document.getElementById(containerId).innerHTML
        : content
    highlightIndexes.forEach(highlightIndex => {
      options.content = newContent
      newContent = this.highlight(highlightIndex, options)
    })

    if (!isBrowser || !containerId || returnContent) {
      return newContent
    }
  }

  searchAndHighlight(str, options) {
    const highlightIndex = this.search(str, options.searchOptions)
    if (highlightIndex !== -1) {
      return {
        highlightIndex,
        content: this.highlight(highlightIndex, options.highlightOptions)
      }
    }
  }

  // add searchAndHighlightAll***

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

    this.highlights[highlightIndex].highlighted = false

    if (byStringOperation) {
      if (isBrowser && containerId) {
        content = document.getElementById(containerId).innerHTML
      }

      let newContent = content
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

  // add unighlightAll***

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
    // IE will not be considered***
    if (window.find) {
      document.designMode = 'on'

      // step 1: ask the browser to highlight the found
      const sel = window.getSelection()
      sel.collapse(document.body, 0)
      while (window.find(strWithFixes, caseSensitive)) {
        document.execCommand('hiliteColor', true, 'rgba(255, 255, 255, 0)')
        sel.collapseToEnd()
        // step 2: locate the found within the container where the annotator is applied
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

  // improve later***
  fuzzySearch(prefix, str, postfix, fuzzySearchOptions = {}) {
    const caseSensitive = fuzzySearchOptions.caseSensitive

    let tbThreshold = fuzzySearchOptions.tbThreshold || 0.68
    const tokenBased = fuzzySearchOptions.tokenBased

    let sbThreshold = fuzzySearchOptions.sbThreshold || 0.85
    // const lenRatio = fuzzySearchOptions.lenRatio || 1.2
    const processSentence = fuzzySearchOptions.processSentence
    const sentenceBased =
      fuzzySearchOptions.sentenceBased === undefined ||
      fuzzySearchOptions.sentenceBased

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
      for (const i of strIndexes) {
        const f =
          text.substring(i - prefix.length, i) +
          str +
          text.substring(i + str.length, i + str.length + postfix.length)
        const similarity = TextAnnotator.getSimilarity(
          f,
          fragment,
          caseSensitive
        )
        if (similarity >= tbThreshold) {
          tbThreshold = similarity
          strIndex = i
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
      for (const sentence of sentences) {
        for (const word of words) {
          if (sentence.raw.includes(word)) {
            filteredSentences.push(sentence)
            break
          }
        }
      }

      //step 2.5: remove text that must not be annotated
      if (processSentence) {
        const tagLocations = this.tagLocations
        const length = tagLocations.length
        if (length) {
          let index = 0
          for (const fs of filteredSentences) {
            let raw = fs.raw
            const loc = [fs.index, fs.index + raw.length]
            let locInc = 0
            for (let i = index; i < length; i++) {
              const tagLoc = tagLocations[i]
              if (tagLoc[0] >= loc[0] && tagLoc[0] <= loc[1]) {
                const tag = this.originalContent.substring(
                  tagLoc[0] + tagLoc[2],
                  tagLoc[0] + tagLoc[2] + tagLoc[1]
                )
                const insertIndex = tagLoc[0] + locInc - loc[0]
                raw = raw.slice(0, insertIndex) + tag + raw.slice(insertIndex)
                locInc += tagLoc[1]
              } else if (tagLoc[0] > loc[1]) {
                index = i - 1
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
      }

      // // step 3: find the sentence that includes the most similar str
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

      // // step 4: if such sentence is found, derive and return the location of the most similar str
      // if (bestResult) {
      //   let index = mostPossibleSentence.index
      //   highlightIndex =
      //     this.highlights.push({
      //       loc: [index + bestResult.loc[0], index + bestResult.loc[1]]
      //     }) - 1
      // }

      let mostPossibleSentence = null
      filteredSentences.forEach((sentence, index) => {
        const similarity = TextAnnotator.getSimilarity(
          sentence.raw,
          str,
          caseSensitive
        )
        if (similarity >= sbThreshold) {
          sbThreshold = similarity
          mostPossibleSentence = sentence
        } else if (index !== filteredSentences.length - 1) {
          // combine two sentences to reduce the inaccuracy of sentenizing text
          const newSentenceRaw = sentence.raw + filteredSentences[index + 1].raw
          const lengthDiff =
            Math.abs(newSentenceRaw.length - str.length) / str.length
          // whether allowing the customization of lengthDiffThreshold
          if (lengthDiff <= 0.1) {
            const newSimilarity = TextAnnotator.getSimilarity(
              sentence.raw,
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
      })

      if (mostPossibleSentence) {
        const result = TextAnnotator.getBestSubstring(
          mostPossibleSentence.raw,
          str,
          sbThreshold,
          2,
          false,
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

  // improve later***
  adjustLoc(highlightIdPattern, highlightIndex, highlightClass) {
    const highlightLoc = this.highlights[highlightIndex].loc
    const locInc = [0, 0]

    // step 1: check locations of tags
    const tagLocations = this.tagLocations
    const length = tagLocations.length
    for (let i = 0; i < length; i++) {
      const tagLoc = tagLocations[i]
      if (highlightLoc[1] < tagLoc[0]) {
        break
      } else if (highlightLoc[1] === tagLoc[0]) {
        const tag = this.originalContent.substring(
          tagLoc[0] + tagLoc[2],
          tagLoc[0] + tagLoc[2] + tagLoc[1]
        )
        if (tag.startsWith('</')) {
          locInc[1] += tagLoc[1]
        }
      } else if (highlightLoc[1] > tagLoc[0]) {
        locInc[1] += tagLoc[1]
        if (highlightLoc[0] === tagLoc[0]) {
          const tag = this.originalContent.substring(
            tagLoc[0] + tagLoc[2],
            tagLoc[0] + tagLoc[2] + tagLoc[1]
          )
          if (tag.startsWith('</')) {
            locInc[0] += tagLoc[1]
          } else {
            let included = false

            let requiredCloseTagNumber = 1
            let closeTagCount = 0
            for (let i2 = i + 1; i2 < tagLocations.length; i2++) {
              const tagLoc2 = tagLocations[i2]
              if (highlightLoc[1] <= tagLoc2[0]) {
                break
              } else {
                const tag2 = this.originalContent.substring(
                  tagLoc2[0] + tagLoc2[2],
                  tagLoc2[0] + tagLoc2[2] + tagLoc2[1]
                )
                const tagType = tag
                  .split(' ')[0]
                  .split('<')[1]
                  .split('>')[0]
                if (tag2.startsWith('<' + tagType)) {
                  requiredCloseTagNumber++
                } else if (tag2.startsWith('</' + tagType)) {
                  closeTagCount++
                }
                if (requiredCloseTagNumber === closeTagCount) {
                  included = true
                  break
                }
              }
            }

            if (!included) {
              locInc[0] += tagLoc[1]
            }
          }
        } else if (highlightLoc[0] > tagLoc[0]) {
          locInc[0] += tagLoc[1]
        }
      }
    }

    // step 2: check locations of other highlights
    this.highlights.forEach((highlight, highlightIndex) => {
      if (highlight.highlighted) {
        const openTagLength = TextAnnotator.getOpenTagLength(
          highlightIdPattern,
          highlightIndex,
          highlightClass
        )
        const closeTagLength = TextAnnotator.getCloseTagLength()
        const loc = highlight.loc
        if (highlightLoc[0] >= loc[1]) {
          locInc[0] += openTagLength + closeTagLength
          locInc[1] += openTagLength + closeTagLength
        } else if (
          highlightLoc[0] < loc[1] &&
          highlightLoc[0] > loc[0] &&
          highlightLoc[1] > loc[1]
        ) {
          locInc[0] += openTagLength
          locInc[1] += openTagLength + closeTagLength
        } else if (highlightLoc[0] <= loc[0] && highlightLoc[1] >= loc[1]) {
          locInc[1] += openTagLength + closeTagLength
        } else if (
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
    })

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
      // can tokenizer return location directly***
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

  static lcsLength(str1, str2) {
    const length1 = str1.length
    const length2 = str2.length
    const x = str1.split('')
    const y = str2.split('')

    const c = Array(length1 + 1).fill(Array(length2 + 1).fill(0))
    for (let i = 1; i <= length1; i++) {
      for (let j = 1; j <= length2; j++) {
        c[i][j] =
          x[i - 1] === y[j - 1]
            ? c[i - 1][j - 1] + 1
            : Math.max(c[i][j - 1], c[i - 1][j])
      }
    }
    return c[length1][length2]
  }
}

export default TextAnnotator
