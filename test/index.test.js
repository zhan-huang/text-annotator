import Highlighter from '../src/text-highlight'

const content =
  '"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang'
const contentObj = () => {
  return { content }
}

const closeTag = '</span>'

test('test direct search', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const highlightIndex = highlighter.search('I')
  const newContent = highlighter.highlight(highlightIndex, options)
  const openTag = highlighter.createOpenTag(highlightIndex)
  expect(newContent).toBe(
    `"${openTag}I${closeTag} am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
  )
})

test('test search all', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const highlightIndexes = highlighter.searchAll('Zhan Huang')
  const newContent = highlighter.highlightAll(highlightIndexes, options)
  const openTag1 = highlighter.createOpenTag(highlightIndexes[0])
  const openTag2 = highlighter.createOpenTag(highlightIndexes[1])
  expect(newContent).toBe(
    `"I am <b><i>${openTag1}Zhan Huang${closeTag}</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - ${openTag2}Zhan Huang${closeTag}`
  )
})

test('test token-based fuzzy search', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const highlightIndex = highlighter.search('frontend developer', {
    prefix: 'a ',
    postfix: ' in EMBLEBI',
    fuzzySearchOptions: {}
  })
  const newContent = highlighter.highlight(highlightIndex, options)
  const openTag = highlighter.createOpenTag(highlightIndex)
  expect(newContent).toBe(
    `"I am <b><i>Zhan Huang</i></b>, a <b>${openTag}frontend developer${closeTag}</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - Zhan Huang`
  )
})

test('test sentence-based fuzzy search', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const highlightIndex = highlighter.search('I like fool', {
    fuzzySearchOptions: {}
  })
  const newContent = highlighter.highlight(highlightIndex, options)
  const openTag = highlighter.createOpenTag(highlightIndex)
  expect(newContent).toBe(
    `"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. ${openTag}I like food${closeTag} and sports. My favourite food is udon noodles." - Zhan Huang`
  )
})

test('test combination of searching and highlighting', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const result = highlighter.searchAndHighlight('sports', {
    highlightOptions: options
  })
  const openTag = highlighter.createOpenTag(result.highlightIndex)
  expect(result.content).toBe(
    `"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and ${openTag}sports${closeTag}. My favourite food is udon noodles." - Zhan Huang`
  )
})

test('test search and highlight all', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const result = highlighter.searchAndHighlightAll('Zhan Huang', {
    highlightOptions: options
  })
  const { content, highlightIndexes } = result
  const openTag1 = highlighter.createOpenTag(highlightIndexes[0])
  const openTag2 = highlighter.createOpenTag(highlightIndexes[1])
  expect(content).toBe(
    `"I am <b><i>${openTag1}Zhan Huang${closeTag}</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like food and sports. My favourite food is udon noodles." - ${openTag2}Zhan Huang${closeTag}`
  )
})

test('test removal of a highlight', () => {
  const options = contentObj()
  const highlighter = new Highlighter(options)
  const result = highlighter.searchAndHighlight('udon noodles', {
    highlightOptions: options
  })
  expect(
    highlighter.unhighlight(result.highlightIndex, {
      byStringOperation: true,
      content: result.content,
      returnContent: true
    })
  ).toBe(content)
})

// test unhighlight all here...
