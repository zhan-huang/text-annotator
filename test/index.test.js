import TextAnnotator from '../src/text-annotator'

const content =
  '"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang'
const contentObj = () => {
  return { content }
}

const closeTag = '</span>'

describe('test main scenarios', () => {
  test('test direct search', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndex = annotator.search('I')
    const newContent = annotator.highlight(highlightIndex, options)
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndex,
      'highlight'
    )
    expect(newContent).toBe(
      `"${openTag}I${closeTag} am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
    )
  })

  test('test search all', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndexes = annotator.searchAll('Zhan Huang')
    const newContent = annotator.highlightAll(highlightIndexes, options)
    const openTag1 = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndexes[0],
      'highlight'
    )
    const openTag2 = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndexes[1],
      'highlight'
    )
    expect(newContent).toBe(
      `"I am ${openTag1}<b><i>Zhan Huang</i></b>${closeTag}, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - ${openTag2}Zhan Huang${closeTag}`
    )
  })

  test('test token-based fuzzy search', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndex = annotator.search('frontend developer', {
      prefix: 'a ',
      postfix: ' in EMBLEBI',
      fuzzySearchOptions: {}
    })
    const newContent = annotator.highlight(highlightIndex, options)
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndex,
      'highlight'
    )
    expect(newContent).toBe(
      `"I am <b><i>Zhan Huang</i></b>, a ${openTag}<b>frontend developer</b>${closeTag} in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
    )
  })

  test('test sentence-based fuzzy search', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndex = annotator.search('I like fool', {
      fuzzySearchOptions: {}
    })
    const newContent = annotator.highlight(highlightIndex, options)
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndex,
      'highlight'
    )
    expect(newContent).toBe(
      `"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. ${openTag}I like food${closeTag} and sports. My favourite food is udon noodles." - Zhan Huang`
    )
  })

  test('test combination of searching and highlighting', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const result = annotator.searchAndHighlight('sports', {
      highlightOptions: options
    })
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      result.highlightIndex,
      'highlight'
    )
    expect(result.content).toBe(
      `"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and ${openTag}sports${closeTag}. My favourite food is udon noodles." - Zhan Huang`
    )
  })

  test('test removal of a highlight', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const result = annotator.searchAndHighlight('udon noodles', {
      highlightOptions: options
    })
    expect(
      annotator.unhighlight(result.highlightIndex, {
        byStringOperation: true,
        content: result.content,
        returnContent: true
      })
    ).toBe(content)
  })
})

describe('test edge cases', () => {
  test('ec1', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndex = annotator.search('I am Zhan Huang')
    const newContent = annotator.highlight(highlightIndex, options)
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndex,
      'highlight'
    )
    expect(newContent).toBe(
      `"${openTag}I am <b><i>Zhan Huang</i></b>${closeTag}, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
    )
  })

  test('ec2', () => {
    const options = contentObj()
    const annotator = new TextAnnotator(options)
    const highlightIndex = annotator.search('frontend developer in EMBL-EBI')
    const newContent = annotator.highlight(highlightIndex, options)
    const openTag = TextAnnotator.createOpenTag(
      'highlight-',
      highlightIndex,
      'highlight'
    )
    expect(newContent).toBe(
      `"I am <b><i>Zhan Huang</i></b>, a ${openTag}<b>frontend developer</b> in EMBL-EBI${closeTag}. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
    )
  })
})
