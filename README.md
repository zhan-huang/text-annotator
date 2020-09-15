# text-annotator
A JavaScript library for annotating plain text in the HTML
The annotation process is:
1. **Search**: Search for a piece of plain text in the HTML; if finding it, store its location identified by an index and then return the index for later annotation
2. **Annotate**: Annotate the found text given its index
It can be seen that in order to annotate a piece of text, two steps, **search** and **annotate**, are taken. The idea of decomposing the annotation process into the two steps is to allow more flexibility, e.g., the user can search for all pieces of text first, and then annotate (some of) them later when required (e.g., when clicking a button). There is also a function combining the two steps, as can be seen in the Basic usage section.

## Import
1. install it via npm
`npm install --save text-annotator`
```javascript
import TextAnnotator from 'text-annotator'
```
2. include it into the head tag
```
<script src="public/js/text-annotator.min.js"></script>
```

## An example of the usage
```javascript
// below is the HTML
// <div id="content"><p><b>Europe PMC</b> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p></p>Europe PMC is <i>developed by <b>EMBL-EBI</b></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>

// create an instance of TextAnnotator
// containerId is the id of the HTML container
var containerObj = {containerId: 'content'}
var annotator = new TextAnnotator(containerObj)

// search for 'EMBL-EBI' in the HTML
// if found, store the location of 'EMBL-EBI' and then return the index; otherwise return -1
var highlightIndex = annotator.search('EMBL-EBI')
// highlightIndex = 0

// annotate 'EMBL-EBI' in the HTML
if (highlightIndex !== -1) {
  annotator.highlight(highlightIndex, containerObj)
  // <span id="highlight-0" class="highlight"> is used to annotate 'EMBL-EBI', see below
  // <div id="content"><p><b>Europe PMC</b> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p></p>Europe PMC is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>
}

// search all occurances of 'Europe PMC' in the HTML
var highlightIndexes = annotator.searchAll('Europe PMC')
// highlightIndexes = [1, 2]

// annotate all found occurances of 'Europe PMC' given their indexes
if (highlightIndexes.length) {
  annotator.highlightAll(highlightIndexes, containerObj)
  // <span id="highlight-1" class="highlight"> and <span id="highlight-2" class="highlight"> are used to annotate 'Europe PMC', see below
  // <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is a partner of <b>PubMed Central</b> and a repository of choice for many international science funders.</p></div>
}

// search and annotate 'a partner of PubMed Central'
annotator.searchAndHighlight('a partner of PubMed Central', {highlightOptions: containerObj})
// <span id="highlight-3" class="highlight"> is used to annotate 'a partner of PubMed Central', see below
// <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <span id="highlight-0" class="highlight"><b>EMBL-EBI</b></span></i>. It is <span id="highlight-3" class="highlight">a partner of <b>PubMed Central</b></span> and a repository of choice for many international science funders.</p></div>

// remove annotation 'EMBL-EBI' given its index
// the index is 0 as shown above
annotator.unhighlight(highlightIndex)
// annotation <span id="highlight-0" class="highlight"> is removed, see below
// <div id="content"><p><span id="highlight-1" class="highlight"><b>Europe PMC</b><span> is an <i>open science platform</i> that enables access to a worldwide collection of life science publications and preprints from trusted sources around the globe.</p><p><span id="highlight-2" class="highlight">Europe PMC</span> is <i>developed by <b>EMBL-EBI</b></i>. It is <span id="highlight-3" class="highlight">a partner of <b>PubMed Central</b></span> and a repository of choice for many international science funders.</p></div>
```

## Constructor options
*new TextAnnotator(**options**)*
| Prop | Type | Description |
| ---- | ---- | ---- |
| containerId | string | The ID of the container element. A piece of text within this container element can be annotated. |
| content | string | The HTML string within which a piece of text can be annotated. Either *containerId* or *content* needs to be specified; if both specified, *containerId* is used. |

## Search options
*search(str, **options**)*
*searchAll(str, **options**)*
| Prop | Type | Description |
| ---- | ---- | ---- |
| trim | boolean | Whether to trim the piece of text to be annotated. Default is *true*. |

## Annotate options
*highlight(highlightIndex, **options**)*
*highlightAll(highlightIndexes, **options**)*
*unhighlight(highlightIndex, **options**)*
| Prop | Type | Description |
| ---- | ---- | ---- |
| containerId | string | Same as *containerId* in the constructor options. Note that to annotate a piece of text within the container element where some text has been annotated, the same *containerId* should be used. |
| content | string | The HTML string within which the piece of text will be annotated. Note that to annotate another piece of text, the HTML string should include the previous annotations. Either containerId or content is required. If both specified, containerId is used. |
| highlightClass | string | The class name of the annotation tag. Default is *highlight* so that the tag is *<span class="highlight" ...>*. |
| highlightIdPattern | string | The ID pattern of the annotation tag. Default is *highlight-* so that the tag is *<span id="highlight-[highlightIndex]" ...>*. |
| returnContent | boolean | Whether to return the HTML string after annotation. Note that *content* and *returnContent* can be used together to annotate multiple pieces of text. Default is *false*. |

## searchAndHighlight options
*searchAndHighlight(str, **options**)*, where
*options = { searchOptions, highlightOptions }*, *searchOptions* and *highlightOptions* are described above.

## Examples from Europe PMC
text-annotator has been widely used in [Europe PMC](https://europepmc.org "Europe PMC"), an open science platform that enables access to a worldwide collection of life science publications. Here is a list of examples:
1. Article title highlighting: https://europepmc.org/search?query=cancer
!["Article title highlighting" "Article title highlighting"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example.JPG)
2. Snippets: https://europepmc.org/article/PPR/PPR158972 (Visit from https://europepmc.org/search?query=cancer)
!["Snippets" "Snippets"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example2.JPG)
3. SciLite: https://europepmc.org/article/PPR/PPR158972 (Click the Annotations link in the right panel)
!["SciLite" "SciLite"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example3.JPG)
4. Linkback: https://europepmc.org/article/PPR/PPR158957#europepmc-85a627f3ccf1d524b850dd149add4605
!["Linkback" "Linkback"](https://raw.githubusercontent.com/zhan-huang/assets/master/text-annotator/example4.JPG)

## Contact
[Zhan Huang](mailto:z2hm@outlook.com "Zhan Huang")
