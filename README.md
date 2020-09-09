# text-annotator
A JavaScript library for locating and annotating plain text in the HTML<br />
The annotation process is:
1. Search for the plain text in the HTML; if finding it, store the location identified by an index and then return the index
2. Annotate the found text given its index
It can be seen that to annotate a piece of text, the process is search -> annotate. The idea of decomposing the annotation process is to allow more flexibility, e.g., the user can search all necessary text first, and then annotate/highlight it when required (e.g., when clicking a button). There is a function for directly annotating the text

## Import
1. via npm
`npm install --save text-annotator`
```javascript
import TextAnnotator from 'text-annotator'
```
2. include into head tag
```
<script src="public/js/text-annotator.min.js"></script>
```

## Basic usage
<p id="content">"I am <b><i>Zhan Huang</i></b>, a <b>frontend developer</b> in EMBL-EBI. I like <b>food</b> and <b>sports</b>. My favourite food is <b>udon&nbsp;noodles</b> and my favourite sports are <b>badminton</b> and <b>football</b>. Let us be friends!" - Zhan Huang</p>
```javascript
// create an instance of TextAnnotator
// containerId is the id of the HTML container
var containerObj = {containerId: 'content'}
var annotator = new TextAnnotator(containerObj)

// search for the text in HTML
// if found, store the location of the text and then return the index; otherwise return -1
var highlightIndex = annotator.search('frontend developer')

// annotate
if (highlightIndex !== -1) {
  annotator.highlight(highlightIndex, containerObj)
}

// search all occurances of the text
var indexes = annotator.search('Zhan Huang')
if (highlightIndexes.length) {
  // show all annotations given their indexes
  annotator.highlightAll(highlightIndexes, containerObj)
}

// search and annotate
annotator.searchAndHighlight('badminton and football', {highlightOptions: containerObj})

// remove the annotation by the index
annotator.unhighlight(highlightIndex)
```

## Options

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
