# text-annotator
A JavaScript library for annotating plain text in the HTML<br />
The annotation process is:
1. **Search**: Search for a piece of plain text in the HTML; if finding it, store its location identified by an index and then return the index for later annotation
2. **Annotate**: Annotate the found text given its index<br />
It can be seen that in order to annotate a piece of text, two steps, **search** and **annotate**, are taken. The idea of decomposing the annotation process into the two steps is to allow more flexibility, e.g., the user can search for all pieces of text first, and then annotate (some of) them later when required (e.g., when clicking a button). There is also a function combining the two steps, as can be seen in the **An example of the usage** section.<br />
*text-annotator* can be used in the browser or the Node.js server.

## Import
### install it via npm
`npm install --save text-annotator`
```javascript
import TextAnnotator from 'text-annotator'
```
### include it into the head tag
```
<script src="public/js/text-annotator.min.js"></script>
```

## An example of the usage
```javascript
// below is the HTML
// <div id="content"><p><b>Europe PMC</b> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p></p>Europe PMC is <i>developed by <b>EMBL-EBI</b></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>

// create an instance of TextAnnotator
// content is the HTML string within which a piece of text can be annotated
var annotator = new TextAnnotator({content: document.getElementById('content').innerHTML})

// search for 'EMBL-EBI' in the HTML
// if found, store the location of 'EMBL-EBI' and then return the index; otherwise return -1
var highlightIndex = annotator.search('EMBL-EBI')
// highlightIndex = 0

// annotate 'EMBL-EBI' in the HTML
if (highlightIndex !== -1) {
  document.getElementById('content').innerHTML = annotator.highlight(highlightIndex)
  // <span id="highlight-0" class="highlight"> is used to annotate 'EMBL-EBI', see below
  // <div id="content"><p><b>Europe PMC</b> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p></p>Europe PMC is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>
}

// search for all occurances of 'Europe PMC' in the HTML
var highlightIndexes = annotator.searchAll('Europe PMC')
// highlightIndexes = [1, 2]

// annotate all the found occurances of 'Europe PMC' given their indexes
if (highlightIndexes.length) {
  document.getElementById('content').innerHTML = annotator.highlightAll(highlightIndexes)
  // <span id="highlight-1" class="highlight"> and <span id="highlight-2" class="highlight"> are used to annotate 'Europe PMC', see below
  // <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>
}

// search for and then annotate 'a partner of PubMed Central'
document.getElementById('content').innerHTML = annotator.searchAndHighlight('a partner of PubMed Central').content
// searchAndHighlight returns { content, highlightIndex }
// <span id="highlight-3" class="highlight"> is used to annotate 'a partner of PubMed Central', see below
// <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is <span id="highlight-3" class="highlight">a partner of <b>PubMed Central</b></span> and a repository of choice for many international science funders.</p></div>

// remove annotation 'EMBL-EBI' given its index
// the index is 0 as shown above
document.getElementById('content').innerHTML = annotator.unhighlight(highlightIndex)
// annotation <span id="highlight-0" class="highlight"> is removed, see below
// <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <b>EMBL-EBI</b></i>. It is <span id="highlight-3" class="highlight">a partner of <b>PubMed Central</b></span> and a repository of choice for many international science funders.</p></div>

// help annotate one occurance of 'science' - the one within 'international science funders', by providing the prefix and postfix of 'Europe PMC'
var highlightIndex = annotator.search('science', { prefix: 'international ', postfix: ' funders' })
if (highlightIndex !== -1) {
  document.getElementById('content').innerHTML = annotator.highlight(highlightIndex)
}
// <span id="highlight-4" class="highlight"> is used to annotate 'science' within 'international science funders', see below
// <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <b>EMBL-EBI</b></i>. It is <span id="highlight-3" class="highlight">a partner of <b>PubMed Central</b></span> and a repository of choice for many international <span id="highlight-4" class="highlight">science</span> funders.</p></div>
```

## Constructor options
#### new TextAnnotator(*options*)
| Prop | Type | Description |
| ---- | ---- | ---- |
| content | string | The HTML string within which a piece of text can be annotated. |

## Search options
#### search(str, *options*)
#### searchAll(str, *options*)
| Prop | Type | Description |
| ---- | ---- | ---- |
| trim | boolean | Whether to trim the piece of text to be annotated. Default is *true*. |
| caseSensitive | boolean | Whether to consider case in search. Default is *false*. |
| prefix | string | A string BEFORE the piece of text to be annotated. Default is ''. |
| postfix | string | A string AFTER the piece of text to be annotated. Default is ''. |

## Annotate options
#### highlight(highlightIndex, *options*)
#### highlightAll(highlightIndexes, *options*)
#### unhighlight(highlightIndex, *options*)
| Prop | Type | Description |
| ---- | ---- | ---- |
| highlightClass | string | The class name of the annotation tag. Default is *highlight* so that the tag is *<span class="highlight" ...>*. |
| highlightIdPattern | string | The ID pattern of the annotation tag. Default is *highlight-* so that the tag is *<span id="highlight-[highlightIndex]" ...>*. |

## searchAndHighlight options
*searchAndHighlight(str, **options**)*, where *options = { searchOptions, highlightOptions }*, *searchOptions* and *highlightOptions* are described above in the Annotate options table.

## Examples from Europe PMC
text-annotator has been widely used in [Europe PMC](https://europepmc.org "Europe PMC"), an open science platform that enables access to a worldwide collection of life science publications. Here is a list of examples:
1. Article title highlighting: https://europepmc.org/search?query=cancer
!["Article title highlighting" "Article title highlighting"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example.JPG)
2. Snippets: https://europepmc.org/article/PPR/PPR158972 (Visit from https://europepmc.org/search?query=cancer)
!["Snippets" "Snippets"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example2.JPG)
3. SciLite: https://europepmc.org/article/PPR/PPR158972 (Click the Annotations link in the right panel)
!["SciLite" "SciLite"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example3.JPG)
4. Linkback: https://europepmc.org/article/PPR/PPR158972#europepmc-6e6312219dcad15c9a7dda8f71dce9af (In the popup shown in Example 3, click "Share" to get this linkback URL)
!["Linkback" "Linkback"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example4.JPG)

## Contact
[Zhan Huang](mailto:z2hm@outlook.com "Zhan Huang")
