"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sbd_1 = require("./ext/sbd");
var encode = function (str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};
// div inside span is a bad idea
var blockElements = [
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
var TextAnnotator = /** @class */ (function () {
    function TextAnnotator(options) {
        if (options === void 0) { options = { content: '' }; }
        this.content = '';
        // isHTML is used to reduce the memory used: stripedHTML is empty if isHTML is false
        this.isHTML = true;
        this.originalContent = '';
        // annotatedContent is introduced in order to avoid passing content in the methods
        this.annotatedContent = '';
        // stripedHTML and tagLocations are needed only when the content is HTML
        this.stripedHTML = '';
        this.tagLocations = [];
        // sentences are used in sentence-based fuzzy search
        this.sentences = [];
        // future work: one highlight can have more than one location because of the potential issue in tag insertion
        this.highlights = [];
        var content = options.content;
        var isHTML = options.isHTML === undefined || options.isHTML;
        this.originalContent = this.annotatedContent = content;
        this.isHTML = isHTML;
        if (isHTML) {
            this.stripAndStoreHTMLTags();
        }
    }
    // the order of directSearch => fuzzy search => eager search is tailored for specific feature, it is now the default way of search but it can be customized via options. More customizations can be done by composing functions
    TextAnnotator.prototype.search = function (str, options) {
        if (options === void 0) { options = {}; }
        var prefix = options.prefix || '';
        var postfix = options.postfix || '';
        var directSearchOptions = options.directSearchOptions || {};
        var fuzzySearchOptions = options.fuzzySearchOptions;
        var eagerSearchOptions = options.eagerSearchOptions;
        // trim by default
        var trim = options.trim === undefined || options.trim;
        // used unless overwritten
        var caseSensitive = options.caseSensitive;
        if (trim) {
            var res = TextAnnotator.trim(prefix, str, postfix);
            prefix = res.prefix;
            str = res.str;
            postfix = res.postfix;
        }
        var highlightIndex = -1;
        // direct search will always be performed
        highlightIndex = this.directSearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, directSearchOptions));
        if (highlightIndex !== -1) {
            return highlightIndex;
        }
        // experimental feature
        if (fuzzySearchOptions) {
            highlightIndex = this.fuzzySearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, fuzzySearchOptions));
            if (highlightIndex !== -1) {
                return highlightIndex;
            }
        }
        // experimental feature
        // eager search only works in (particular) browsers
        if (eagerSearchOptions) {
            highlightIndex = this.eagerSearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, eagerSearchOptions));
            if (highlightIndex !== -1) {
                return highlightIndex;
            }
        }
        return highlightIndex;
    };
    // experimental feature
    // only support direct search for now
    TextAnnotator.prototype.searchAll = function (str, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var highlightIndexes = [];
        var continueSearch = function (str, options) {
            var highlightIndex = _this.search(str, options);
            if (highlightIndex !== -1) {
                highlightIndexes.push(highlightIndex);
                options.directSearchOptions = options.directSearchOptions || {};
                options.directSearchOptions.lastHighlightIndex = highlightIndex;
                continueSearch(str, options);
            }
        };
        continueSearch(str, options);
        return highlightIndexes;
    };
    TextAnnotator.prototype.highlight = function (highlightIndex, options) {
        if (options === void 0) { options = {}; }
        var highlightTagName = options.highlightTagName || 'span';
        var highlightClass = options.highlightClass || 'highlight';
        var highlightIdPattern = options.highlightIdPattern || 'highlight-';
        var openTag = TextAnnotator.createOpenTag(highlightTagName, highlightIdPattern, highlightIndex, highlightClass);
        var loc = this.adjustLoc(highlightTagName, highlightIdPattern, highlightIndex, highlightClass);
        this.annotatedContent = TextAnnotator.insert(this.annotatedContent, openTag, loc[0]);
        this.annotatedContent = TextAnnotator.insert(this.annotatedContent, TextAnnotator.createCloseTag(highlightTagName), loc[1] + openTag.length);
        // it has to be set after adjustLoc so that it will not be checked
        this.highlights[highlightIndex].highlighted = true;
        return this.annotatedContent;
    };
    // experimental feature
    TextAnnotator.prototype.highlightAll = function (highlightIndexes, options) {
        if (options === void 0) { options = {}; }
        for (var i = 0; i < highlightIndexes.length; i++) {
            this.annotatedContent = this.highlight(highlightIndexes[i], options);
        }
        return this.annotatedContent;
    };
    TextAnnotator.prototype.searchAndHighlight = function (str, options) {
        if (options === void 0) { options = {}; }
        var highlightIndex = this.search(str, options.searchOptions);
        if (highlightIndex !== -1) {
            return {
                highlightIndex: highlightIndex,
                content: this.highlight(highlightIndex, options.highlightOptions),
            };
        }
    };
    TextAnnotator.prototype.unhighlight = function (highlightIndex, options) {
        if (options === void 0) { options = {}; }
        var highlightTagName = options.highlightTagName || 'span';
        var highlightClass = options.highlightClass || 'highlight';
        var highlightIdPattern = options.highlightIdPattern || 'highlight-';
        // it has to be set before adjustLoc so that it will not be checked
        this.highlights[highlightIndex].highlighted = false;
        // need to change when one annotation => more than one highlight
        var loc = this.adjustLoc(highlightTagName, highlightIdPattern, highlightIndex, highlightClass);
        var openTagLength = TextAnnotator.getOpenTagLength(highlightTagName, highlightIdPattern, highlightIndex, highlightClass);
        var substr1 = this.annotatedContent.substring(loc[0], loc[1] + openTagLength + TextAnnotator.getCloseTagLength(highlightTagName));
        var substr2 = this.annotatedContent.substring(loc[0] + openTagLength, loc[1] + openTagLength);
        this.annotatedContent = this.annotatedContent.replace(substr1, substr2);
        return this.annotatedContent;
    };
    TextAnnotator.prototype.stripAndStoreHTMLTags = function () {
        var tag;
        this.stripedHTML = this.originalContent;
        var tagRegEx = /<[^>]+>/;
        var indexInc = 0;
        while ((tag = this.stripedHTML.match(tagRegEx))) {
            this.stripedHTML = this.stripedHTML.replace(tag[0], '');
            var tagLength = tag[0].length;
            // tagLocations will be used in adjustLoc
            this.tagLocations.push([tag.index, tagLength, indexInc]);
            indexInc += tagLength;
        }
    };
    TextAnnotator.prototype.directSearch = function (prefix, str, postfix, directSearchOptions) {
        if (directSearchOptions === void 0) { directSearchOptions = {}; }
        var caseSensitive = directSearchOptions.caseSensitive;
        // experimental option; used for specific feature
        var ifEncode = directSearchOptions.encode;
        var lastHighlightIndex = directSearchOptions.lastHighlightIndex;
        var strWithFixes = prefix + str + postfix;
        var text = this.isHTML ? this.stripedHTML : this.originalContent;
        if (!caseSensitive) {
            strWithFixes = strWithFixes.toLowerCase();
            text = text.toLowerCase();
        }
        // for searchAll
        var offset = 0;
        if (lastHighlightIndex !== undefined) {
            offset = this.highlights[lastHighlightIndex].loc[1] + 1;
        }
        var highlightIndex = -1;
        var index = text.indexOf(strWithFixes, offset);
        // experimental feature: if the text to be searched does not work, try to encode it
        if (ifEncode && index === -1) {
            var encodedStrWithFixes = encode(strWithFixes);
            var index_1 = text.indexOf(encodedStrWithFixes, offset);
            if (index_1 !== -1) {
                var loc = [0, 0];
                loc[0] = index_1 + encode(prefix).length;
                loc[1] = loc[0] + encode(str).length;
                highlightIndex = this.highlights.push({ loc: loc }) - 1;
            }
        }
        else if (index !== -1) {
            var loc = [0, 0];
            loc[0] = index + prefix.length;
            loc[1] = loc[0] + str.length;
            highlightIndex = this.highlights.push({ loc: loc }) - 1;
        }
        return highlightIndex;
    };
    TextAnnotator.prototype.eagerSearch = function (prefix, str, postfix, eagerSearchOptions) {
        if (eagerSearchOptions === void 0) { eagerSearchOptions = { containerId: '' }; }
        var caseSensitive = eagerSearchOptions.caseSensitive;
        var containerId = eagerSearchOptions.containerId;
        var threshold = eagerSearchOptions.threshold || 0.74;
        var strWithFixes = prefix + str + postfix;
        var highlightIndex = -1;
        // IE is not considered
        if (window.find) {
            document.designMode = 'on';
            // step 1: ask the browser to highlight the found
            var sel = window.getSelection();
            sel.collapse(document.body, 0);
            while (window.find(strWithFixes, caseSensitive)) {
                document.execCommand('hiliteColor', true, 'rgba(255, 255, 255, 0)');
                sel.collapseToEnd();
                // step 2: locate the found within the container where the annotator is applied
                // selector may become better
                var found = document.querySelector('#' +
                    containerId +
                    ' [style="background-color: rgba(255, 255, 255, 0);"]');
                if (found) {
                    var foundStr = found.innerHTML.replace(/<[^>]*>/g, '');
                    var result = TextAnnotator.getBestSubstring(foundStr, str, threshold);
                    if (result) {
                        var text = this.isHTML ? this.stripedHTML : this.originalContent;
                        var index = text.indexOf(foundStr);
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
    };
    TextAnnotator.prototype.fuzzySearch = function (prefix, str, postfix, fuzzySearchOptions) {
        var caseSensitive = fuzzySearchOptions.caseSensitive;
        var tokenBased = fuzzySearchOptions.tokenBased;
        var tbThreshold = fuzzySearchOptions.tbThreshold || 0.68;
        // sentence-based fuzzy search is enabled by default
        var sentenceBased = fuzzySearchOptions.sentenceBased === undefined ||
            fuzzySearchOptions.sentenceBased;
        var sbThreshold = fuzzySearchOptions.sbThreshold || 0.85;
        var maxLengthDiff = fuzzySearchOptions.maxLengthDiff || 0.1;
        var lenRatio = fuzzySearchOptions.lenRatio || 2;
        var processSentence = fuzzySearchOptions.processSentence;
        var highlightIndex = -1;
        var text = this.isHTML ? this.stripedHTML : this.originalContent;
        // token-based
        if (tokenBased || prefix || postfix) {
            // step 1: find all indexes of str
            var strIndexes = [];
            var i = -1;
            while ((i = text.indexOf(str, i + 1)) !== -1) {
                strIndexes.push(i);
            }
            // step 2: find the index of the most similar "fragment" - the str with pre- and post- fixes
            var strIndex = -1;
            var fragment = prefix + str + postfix;
            for (var i_1 = 0; i_1 < strIndexes.length; i_1++) {
                var si = strIndexes[i_1];
                // f can be wider
                var f = text.substring(si - prefix.length, si) +
                    str +
                    text.substring(si + str.length, si + str.length + postfix.length);
                var similarity = TextAnnotator.getSimilarity(f, fragment, caseSensitive);
                if (similarity >= tbThreshold) {
                    tbThreshold = similarity;
                    strIndex = si;
                }
            }
            // step 3: check whether the most similar enough "fragment" is found, if yes return its location
            if (strIndex !== -1) {
                highlightIndex =
                    this.highlights.push({ loc: [strIndex, strIndex + str.length] }) - 1;
            }
        }
        // sentence-based
        else if (sentenceBased) {
            // step 1: sentenize the text if has not done so
            var sentences = [];
            if (this.sentences.length) {
                sentences = this.sentences;
            }
            else {
                sentences = this.sentences = TextAnnotator.sentenize(text);
            }
            // step 2 (for efficiency only): filter sentences by words of the str
            var words = str.split(/\s/);
            var filteredSentences = [];
            for (var i = 0; i < sentences.length; i++) {
                for (var j = 0; j < words.length; j++) {
                    if (sentences[i].raw.includes(words[j])) {
                        filteredSentences.push(sentences[i]);
                        break;
                    }
                }
            }
            //step 3 (optional)
            if (processSentence) {
                var index = 0;
                // for each sentence
                for (var i = 0; i < filteredSentences.length; i++) {
                    var fs = filteredSentences[i];
                    var raw = fs.raw;
                    // loc without tags
                    var loc = [fs.index, fs.index + raw.length];
                    var locInc = 0;
                    // add loc of all tags before the one being checked so as to derive the actual loc
                    var tagLocations = this.tagLocations;
                    // for each loc of tag whose loc is larger than the last sentence
                    for (var j = index; j < tagLocations.length; j++) {
                        var tagLoc = tagLocations[j];
                        if (tagLoc[0] >= loc[0] && tagLoc[0] <= loc[1]) {
                            var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                            var insertIndex = tagLoc[0] + locInc - loc[0];
                            raw = raw.slice(0, insertIndex) + tag + raw.slice(insertIndex);
                            locInc += tagLoc[1];
                        }
                        else if (tagLoc[0] > loc[1]) {
                            index = j; // not sure this part
                            break;
                        }
                    }
                    raw = processSentence(raw);
                    raw = raw.replace(/(<([^>]+)>)/gi, '');
                    var copy = fs.raw;
                    // update the sentence if it got reduced
                    if (copy !== raw) {
                        fs.raw = raw;
                        fs.index = fs.index + copy.indexOf(raw);
                    }
                }
            }
            // step 4: find the most possible sentence
            var mostPossibleSentence = null;
            for (var i = 0; i < filteredSentences.length; i++) {
                var sentence = filteredSentences[i];
                var similarity = TextAnnotator.getSimilarity(sentence.raw, str, caseSensitive);
                if (similarity >= sbThreshold) {
                    sbThreshold = similarity;
                    mostPossibleSentence = sentence;
                }
                else if (i !== filteredSentences.length - 1) {
                    // combine two sentences to reduce the inaccuracy of sentenizing text
                    var newSentenceRaw = sentence.raw + filteredSentences[i + 1].raw;
                    var lengthDiff = Math.abs(newSentenceRaw.length - str.length) / str.length;
                    if (lengthDiff <= maxLengthDiff) {
                        var newSimilarity = TextAnnotator.getSimilarity(newSentenceRaw, str, caseSensitive);
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
                var result = TextAnnotator.getBestSubstring(mostPossibleSentence.raw, str, sbThreshold, lenRatio, caseSensitive, true);
                if (result) {
                    var index = mostPossibleSentence.index;
                    highlightIndex =
                        this.highlights.push({
                            loc: [index + result.loc[0], index + result.loc[1]],
                        }) - 1;
                }
            }
        }
        return highlightIndex;
    };
    // future work: further improvement when one annotation binds with more than one highlight
    // includeRequiredTag used in = condition only
    TextAnnotator.prototype.includeRequiredTag = function (i, highlightLoc, tag) {
        var isCloseTag = tag.startsWith('</');
        var tagName = isCloseTag
            ? tag.split('</')[1].split('>')[0]
            : tag.split(' ')[0].split('<')[1].split('>')[0];
        var included = false;
        var requiredTagNumber = 1;
        var requiredTagCount = 0;
        // if both the start tag and the end tag are at the borders, place the tags outside the borders
        // if the close tag is at the border, check backwards until the start of the highlight
        if (isCloseTag) {
            for (var i2 = i - 1; i2 >= 0; i2--) {
                var tagLoc2 = this.tagLocations[i2];
                if (highlightLoc[0] > tagLoc2[0]) {
                    break;
                }
                else {
                    var tag2 = this.originalContent.substring(tagLoc2[0] + tagLoc2[2], tagLoc2[0] + tagLoc2[2] + tagLoc2[1]);
                    if (tag2.startsWith('</' + tagName)) {
                        requiredTagNumber++;
                    }
                    else if (tag2.startsWith('<' + tagName)) {
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
            for (var i2 = i + 1; i2 < this.tagLocations.length; i2++) {
                var tagLoc2 = this.tagLocations[i2];
                if (highlightLoc[1] < tagLoc2[0]) {
                    break;
                }
                else {
                    var tag2 = this.originalContent.substring(tagLoc2[0] + tagLoc2[2], tagLoc2[0] + tagLoc2[2] + tagLoc2[1]);
                    if (tag2.startsWith('<' + tagName)) {
                        requiredTagNumber++;
                    }
                    else if (tag2.startsWith('</' + tagName)) {
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
    };
    TextAnnotator.prototype.adjustLoc = function (highlightTagName, highlightIdPattern, highlightIndex, highlightClass) {
        if (highlightTagName === void 0) { highlightTagName = 'span'; }
        var highlightLoc = this.highlights[highlightIndex].loc;
        var locInc = [0, 0];
        // step 1: check locations of tags
        var length = this.tagLocations.length;
        for (var i = 0; i < length; i++) {
            var tagLoc = this.tagLocations[i];
            // start end tag
            if (highlightLoc[1] < tagLoc[0]) {
                break;
            }
            // start end&tag
            else if (highlightLoc[1] === tagLoc[0]) {
                var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                // if end tag, not block element and include the required close tag, add right to the tag
                if (!tag.endsWith('/>') &&
                    tag.startsWith('</') &&
                    !blockElements.includes(tag.split('</')[1].split('>')[0]) &&
                    this.includeRequiredTag(i, highlightLoc, tag)) {
                    locInc[1] += tagLoc[1];
                }
            }
            // start tag end
            else if (highlightLoc[1] > tagLoc[0]) {
                locInc[1] += tagLoc[1];
                // start&tag end
                if (highlightLoc[0] === tagLoc[0]) {
                    var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                    // if self close tag or end tag or block element or not include the required close tag, add right to the tag
                    if (tag.startsWith('</') ||
                        tag.endsWith('/>') ||
                        blockElements.includes(tag.split(' ')[0].split('<')[1].split('>')[0]) ||
                        !this.includeRequiredTag(i, highlightLoc, tag)) {
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
        for (var i = 0; i < this.highlights.length; i++) {
            var highlight = this.highlights[i];
            // only check the highlighted
            if (highlight.highlighted) {
                var openTagLength = TextAnnotator.getOpenTagLength(highlightTagName, highlightIdPattern, i, highlightClass);
                var closeTagLength = TextAnnotator.getCloseTagLength(highlightTagName);
                var loc = highlight.loc;
                if (highlightLoc[0] >= loc[1]) {
                    locInc[0] += openTagLength + closeTagLength;
                    locInc[1] += openTagLength + closeTagLength;
                }
                // syntactical correct but semantical incorrect
                else if (highlightLoc[0] < loc[1] &&
                    highlightLoc[0] > loc[0] &&
                    highlightLoc[1] > loc[1]) {
                    locInc[0] += openTagLength;
                    locInc[1] += openTagLength + closeTagLength;
                }
                else if (highlightLoc[0] <= loc[0] && highlightLoc[1] >= loc[1]) {
                    locInc[1] += openTagLength + closeTagLength;
                }
                // syntactical correct but semantical incorrect
                else if (highlightLoc[0] < loc[0] &&
                    highlightLoc[1] > loc[0] &&
                    highlightLoc[1] < loc[1]) {
                    locInc[1] += openTagLength;
                }
                else if (highlightLoc[0] >= loc[0] && highlightLoc[1] <= loc[1]) {
                    locInc[0] += openTagLength;
                    locInc[1] += openTagLength;
                }
            }
        }
        return [highlightLoc[0] + locInc[0], highlightLoc[1] + locInc[1]];
    };
    TextAnnotator.createOpenTag = function (highlightTagName, highlightIdPattern, highlightIndex, highlightClass) {
        if (highlightTagName === void 0) { highlightTagName = 'span'; }
        return "<".concat(highlightTagName, " id=\"").concat(highlightIdPattern + highlightIndex, "\" class=\"").concat(highlightClass, "\">");
    };
    TextAnnotator.createCloseTag = function (highlightTagName) {
        if (highlightTagName === void 0) { highlightTagName = 'span'; }
        return "</".concat(highlightTagName, ">");
    };
    TextAnnotator.getOpenTagLength = function (highlightTagName, highlightIdPattern, highlightIndex, highlightClass) {
        if (highlightTagName === void 0) { highlightTagName = 'span'; }
        return TextAnnotator.createOpenTag(highlightTagName, highlightIdPattern, highlightIndex, highlightClass).length;
    };
    TextAnnotator.getCloseTagLength = function (highlightTagName) {
        if (highlightTagName === void 0) { highlightTagName = 'span'; }
        return TextAnnotator.createCloseTag(highlightTagName).length;
    };
    TextAnnotator.trim = function (prefix, str, postfix) {
        prefix = prefix.replace(/^\s+/, '');
        postfix = postfix.replace(/\s+$/, '');
        if (!prefix) {
            str = str.replace(/^\s+/, '');
        }
        if (!postfix) {
            str = str.replace(/\s+$/, '');
        }
        return { prefix: prefix, str: str, postfix: postfix };
    };
    TextAnnotator.insert = function (str1, str2, index) {
        return str1.slice(0, index) + str2 + str1.slice(index);
    };
    TextAnnotator.sentenize = function (text) {
        var options = {
            newline_boundaries: false,
            html_boundaries: false,
            sanitize: false,
            allowed_tags: false,
            preserve_whitespace: true,
            // abbreviations: null,
        };
        return (0, sbd_1.default)(text, options).map(function (raw) {
            // future work: can tokenizer return location directly
            var index = text.indexOf(raw);
            return { raw: raw, index: index };
        });
    };
    TextAnnotator.getBestSubstring = function (str, substr, threshold, lenRatio, caseSensitive, skipFirstRun) {
        var result = null;
        var similarity = skipFirstRun
            ? threshold
            : TextAnnotator.getSimilarity(str, substr, caseSensitive);
        if (similarity >= threshold) {
            // step 1: derive best substr
            // future work: /s may be better
            var words = str.split(' ');
            while (words.length) {
                var firstWord = words.shift();
                var newStr = words.join(' ');
                var newSimilarity = TextAnnotator.getSimilarity(newStr, substr, caseSensitive);
                if (newSimilarity < similarity) {
                    words.unshift(firstWord);
                    var lastWord = words.pop();
                    newSimilarity = TextAnnotator.getSimilarity(words.join(' '), substr, caseSensitive);
                    if (newSimilarity < similarity) {
                        words.push(lastWord);
                        break;
                    }
                    else {
                        similarity = newSimilarity;
                    }
                }
                else {
                    similarity = newSimilarity;
                }
            }
            var bestSubstr = words.join(' ');
            // step 2: return the best substr and its loc if found and if it meets the threshold and the length ratio
            if (!lenRatio || bestSubstr.length / substr.length <= lenRatio) {
                var loc = [0, 0];
                loc[0] = str.indexOf(bestSubstr);
                loc[1] = loc[0] + bestSubstr.length;
                result = { similarity: similarity, loc: loc };
            }
        }
        return result;
    };
    TextAnnotator.getSimilarity = function (str1, str2, caseSensitive) {
        if (!caseSensitive) {
            str1 = str1.toLowerCase();
            str2 = str2.toLowerCase();
        }
        if (str1 === str2)
            return 1;
        // set str2 to denominator
        return TextAnnotator.lcsLength(str1, str2) / str2.length;
    };
    // copy from the code in https://www.npmjs.com/package/longest-common-subsequence
    TextAnnotator.lcsLength = function (firstSequence, secondSequence, caseSensitive) {
        function createArray(dimension) {
            var array = [];
            for (var i_2 = 0; i_2 < dimension; i_2++) {
                array[i_2] = [];
            }
            return array;
        }
        var firstString = caseSensitive
            ? firstSequence
            : firstSequence.toLowerCase();
        var secondString = caseSensitive
            ? secondSequence
            : secondSequence.toLowerCase();
        if (firstString === secondString) {
            return firstString.length;
        }
        if ((firstString || secondString) === '') {
            return ''.length;
        }
        var firstStringLength = firstString.length;
        var secondStringLength = secondString.length;
        var lcsMatrix = createArray(secondStringLength + 1);
        var i;
        var j;
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
                }
                else {
                    lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
                }
            }
        }
        var lcs = '';
        i = secondStringLength;
        j = firstStringLength;
        while (i > 0 && j > 0) {
            if (firstString[j - 1] === secondString[i - 1]) {
                lcs = firstString[j - 1] + lcs;
                i--;
                j--;
            }
            else if (Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]) ===
                lcsMatrix[i - 1][j]) {
                i--;
            }
            else {
                j--;
            }
        }
        return lcs.length;
    };
    return TextAnnotator;
}());
exports.default = TextAnnotator;
