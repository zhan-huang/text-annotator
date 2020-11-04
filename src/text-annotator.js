"use strict";
exports.__esModule = true;
var sbd_1 = require("./ext/sbd");
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
var TextAnnotator = (function () {
    function TextAnnotator(_a) {
        var content = _a.content, _b = _a.isHTML, isHTML = _b === void 0 ? true : _b;
        this.originalContent = this.annotatedContent = content;
        this.isHTML = isHTML;
        this.stripedHTML = '';
        this.tagLocations = [];
        this.sentences = [];
        this.highlights = [];
        if (isHTML) {
            this.stripAndStoreHTMLTags();
        }
    }
    TextAnnotator.prototype.search = function (str, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.prefix, prefix = _c === void 0 ? '' : _c, _d = _b.postfix, postfix = _d === void 0 ? '' : _d, _e = _b.directSearchOptions, directSearchOptions = _e === void 0 ? {} : _e, fuzzySearchOptions = _b.fuzzySearchOptions, eagerSearchOptions = _b.eagerSearchOptions, _f = _b.trim, trim = _f === void 0 ? true : _f, _g = _b.caseSensitive, caseSensitive = _g === void 0 ? false : _g;
        if (trim) {
            var res = TextAnnotator.trim(prefix, str, postfix);
            prefix = res.prefix;
            str = res.str;
            postfix = res.postfix;
        }
        var highlightIndex = -1;
        highlightIndex = this.directSearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, directSearchOptions));
        if (highlightIndex !== -1) {
            return highlightIndex;
        }
        if (fuzzySearchOptions) {
            highlightIndex = this.fuzzySearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, fuzzySearchOptions));
            if (highlightIndex !== -1) {
                return highlightIndex;
            }
        }
        if (eagerSearchOptions) {
            highlightIndex = this.eagerSearch(prefix, str, postfix, Object.assign({ caseSensitive: caseSensitive }, eagerSearchOptions));
            if (highlightIndex !== -1) {
                return highlightIndex;
            }
        }
        return highlightIndex;
    };
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
    TextAnnotator.prototype.highlight = function (highlightIndex, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.highlightClass, highlightClass = _c === void 0 ? 'highlight' : _c, _d = _b.highlightIdPattern, highlightIdPattern = _d === void 0 ? 'highlight-' : _d;
        var openTag = TextAnnotator.createOpenTag(highlightIdPattern, highlightIndex, highlightClass);
        var loc = this.adjustLoc(highlightIdPattern, highlightIndex, highlightClass);
        this.annotatedContent = TextAnnotator.insert(this.annotatedContent, openTag, loc[0]);
        this.annotatedContent = TextAnnotator.insert(this.annotatedContent, TextAnnotator.createCloseTag(), loc[1] + openTag.length);
        this.highlights[highlightIndex].highlighted = true;
        return this.annotatedContent;
    };
    TextAnnotator.prototype.highlightAll = function (highlightIndexes, options) {
        if (options === void 0) { options = {}; }
        for (var i = 0; i < highlightIndexes.length; i++) {
            this.annotatedContent = this.highlight(highlightIndexes[i], options);
        }
        return this.annotatedContent;
    };
    TextAnnotator.prototype.searchAndHighlight = function (str, _a) {
        var _b = _a === void 0 ? {} : _a, searchOptions = _b.searchOptions, highlightOptions = _b.highlightOptions;
        var highlightIndex = this.search(str, searchOptions);
        if (highlightIndex !== -1) {
            return {
                highlightIndex: highlightIndex,
                content: this.highlight(highlightIndex, highlightOptions)
            };
        }
    };
    TextAnnotator.prototype.unhighlight = function (highlightIndex, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.highlightClass, highlightClass = _c === void 0 ? 'highlight' : _c, _d = _b.highlightIdPattern, highlightIdPattern = _d === void 0 ? 'highlight-' : _d;
        this.highlights[highlightIndex].highlighted = false;
        var loc = this.adjustLoc(highlightIdPattern, highlightIndex, highlightClass);
        var openTagLength = TextAnnotator.getOpenTagLength(highlightIdPattern, highlightIndex, highlightClass);
        var substr1 = this.annotatedContent.substring(loc[0], loc[1] + openTagLength + TextAnnotator.getCloseTagLength());
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
            this.stripedHTML = this.stripedHTML.replace(tag, '');
            var tagLength = tag[0].length;
            this.tagLocations.push([tag.index, tagLength, indexInc]);
            indexInc += tagLength;
        }
    };
    TextAnnotator.prototype.directSearch = function (prefix, str, postfix, _a) {
        var _b = _a.caseSensitive, caseSensitive = _b === void 0 ? false : _b, _c = _a.encode, encode = _c === void 0 ? false : _c, lastHighlightIndex = _a.lastHighlightIndex;
        var strWithFixes = prefix + str + postfix;
        var text = this.isHTML ? this.stripedHTML : this.originalContent;
        if (!caseSensitive) {
            strWithFixes = strWithFixes.toLowerCase();
            text = text.toLowerCase();
        }
        var offset = 0;
        if (lastHighlightIndex !== undefined) {
            offset = this.highlights[lastHighlightIndex].loc[1] + 1;
        }
        var highlightIndex = -1;
        var index = text.indexOf(strWithFixes, offset);
        if (encode && index === -1) {
            var Entities = require('html-entities').AllHtmlEntities;
            var entities = new Entities();
            var encodedStrWithFixes = entities.encode(strWithFixes);
            var index_1 = text.indexOf(encodedStrWithFixes, offset);
            if (index_1 !== -1) {
                var loc = [0, 0];
                loc[0] = index_1 + entities.encode(prefix).length;
                loc[1] = loc[0] + entities.encode(str).length;
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
    TextAnnotator.prototype.eagerSearch = function (prefix, str, postfix, _a) {
        var _b = _a.caseSensitive, caseSensitive = _b === void 0 ? false : _b, containerId = _a.containerId, _c = _a.threshold, threshold = _c === void 0 ? 0.74 : _c;
        var strWithFixes = prefix + str + postfix;
        var highlightIndex = -1;
        if (window.find) {
            document.designMode = 'on';
            var sel = window.getSelection();
            sel.collapse(document.body, 0);
            while (window.find(strWithFixes, caseSensitive)) {
                document.execCommand('hiliteColor', true, 'rgba(255, 255, 255, 0)');
                sel.collapseToEnd();
                var found = document.querySelector('#' + containerId + ' [style="background-color: rgba(255, 255, 255, 0);"]');
                if (found) {
                    var foundStr = found.innerHTML.replace(/<[^>]*>/g, '');
                    var result = TextAnnotator.getBestSubstring(foundStr, str, threshold);
                    if (result.similarity) {
                        var text = this.isHTML ? this.stripedHTML : this.originalContent;
                        var index = text.indexOf(foundStr);
                        if (index !== -1) {
                            highlightIndex =
                                this.highlights.push({
                                    loc: [index + result.loc[0], index + result.loc[1]]
                                }) - 1;
                        }
                    }
                    break;
                }
            }
            document.execCommand('undo');
            document.designMode = 'off';
        }
        return highlightIndex;
    };
    TextAnnotator.prototype.fuzzySearch = function (prefix, str, postfix, _a) {
        var caseSensitive = _a.caseSensitive, tokenBased = _a.tokenBased, _b = _a.tbThreshold, tbThreshold = _b === void 0 ? 0.68 : _b, _c = _a.sentenceBased, sentenceBased = _c === void 0 ? true : _c, _d = _a.sbThreshold, sbThreshold = _d === void 0 ? 0.85 : _d, _e = _a.maxLengthDiff, maxLengthDiff = _e === void 0 ? 0.1 : _e, _f = _a.lenRatio, lenRatio = _f === void 0 ? 2 : _f, processSentence = _a.processSentence;
        var highlightIndex = -1;
        var text = this.isHTML ? this.stripedHTML : this.originalContent;
        if (tokenBased || prefix || postfix) {
            var strIndexes = [];
            var i = -1;
            while ((i = text.indexOf(str, i + 1)) !== -1) {
                strIndexes.push(i);
            }
            var strIndex = -1;
            var fragment = prefix + str + postfix;
            for (var i_1 = 0; i_1 < strIndexes.length; i_1++) {
                var si = strIndexes[i_1];
                var f = text.substring(si - prefix.length, si) +
                    str +
                    text.substring(si + str.length, si + str.length + postfix.length);
                var similarity = TextAnnotator.getSimilarity(f, fragment, caseSensitive);
                if (similarity >= tbThreshold) {
                    tbThreshold = similarity;
                    strIndex = si;
                }
            }
            if (strIndex !== -1) {
                highlightIndex = this.highlights.push({ loc: [strIndex, strIndex + str.length] }) - 1;
            }
        }
        else if (sentenceBased) {
            var sentences = [];
            if (this.sentences.length) {
                sentences = this.sentences;
            }
            else {
                sentences = this.sentences = TextAnnotator.sentenize(text);
            }
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
            if (processSentence) {
                var index = 0;
                for (var i = 0; i < filteredSentences.length; i++) {
                    var fs = filteredSentences[i];
                    var raw = fs.raw;
                    var loc = [fs.index, fs.index + raw.length];
                    var locInc = 0;
                    var tagLocations = this.tagLocations;
                    for (var j = index; j < tagLocations.length; j++) {
                        var tagLoc = tagLocations[j];
                        if (tagLoc[0] >= loc[0] && tagLoc[0] <= loc[1]) {
                            var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                            var insertIndex = tagLoc[0] + locInc - loc[0];
                            raw = raw.slice(0, insertIndex) + tag + raw.slice(insertIndex);
                            locInc += tagLoc[1];
                        }
                        else if (tagLoc[0] > loc[1]) {
                            index = j;
                            break;
                        }
                    }
                    raw = processSentence(raw);
                    raw = raw.replace(/(<([^>]+)>)/gi, '');
                    var copy = fs.raw;
                    if (copy !== raw) {
                        fs.raw = raw;
                        fs.index = fs.index + copy.indexOf(raw);
                    }
                }
            }
            var mostPossibleSentence = null;
            for (var i = 0; i < filteredSentences.length; i++) {
                var sentence = filteredSentences[i];
                var similarity = TextAnnotator.getSimilarity(sentence.raw, str, caseSensitive);
                if (similarity >= sbThreshold) {
                    sbThreshold = similarity;
                    mostPossibleSentence = sentence;
                }
                else if (i !== filteredSentences.length - 1) {
                    var newSentenceRaw = sentence.raw + filteredSentences[i + 1].raw;
                    var lengthDiff = Math.abs(newSentenceRaw.length - str.length) / str.length;
                    if (lengthDiff <= maxLengthDiff) {
                        var newSimilarity = TextAnnotator.getSimilarity(newSentenceRaw, str, caseSensitive);
                        if (newSimilarity >= sbThreshold) {
                            sbThreshold = newSimilarity;
                            mostPossibleSentence = {
                                raw: newSentenceRaw,
                                index: sentence.index
                            };
                        }
                    }
                }
            }
            if (mostPossibleSentence) {
                var result = TextAnnotator.getBestSubstring(mostPossibleSentence.raw, str, sbThreshold, lenRatio, caseSensitive, true);
                if (result.loc) {
                    var index = mostPossibleSentence.index;
                    highlightIndex =
                        this.highlights.push({
                            loc: [index + result.loc[0], index + result.loc[1]]
                        }) - 1;
                }
            }
        }
        return highlightIndex;
    };
    TextAnnotator.prototype.includeRequiredTag = function (i, highlightLoc, tag) {
        var isCloseTag = tag.startsWith('</');
        var tagName = isCloseTag
            ? tag.split('</')[1].split('>')[0]
            : tag.split(' ')[0].split('<')[1].split('>')[0];
        var included = false;
        var requiredTagNumber = 1;
        var requiredTagCount = 0;
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
    TextAnnotator.prototype.adjustLoc = function (highlightIdPattern, highlightIndex, highlightClass) {
        var highlightLoc = this.highlights[highlightIndex].loc;
        var locInc = [0, 0];
        var length = this.tagLocations.length;
        for (var i = 0; i < length; i++) {
            var tagLoc = this.tagLocations[i];
            if (highlightLoc[1] < tagLoc[0]) {
                break;
            }
            else if (highlightLoc[1] === tagLoc[0]) {
                var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                if (!tag.endsWith('/>') &&
                    tag.startsWith('</') &&
                    !blockElements.includes(tag.split('</')[1].split('>')[0]) &&
                    this.includeRequiredTag(i, highlightLoc, tag)) {
                    locInc[1] += tagLoc[1];
                }
            }
            else if (highlightLoc[1] > tagLoc[0]) {
                locInc[1] += tagLoc[1];
                if (highlightLoc[0] === tagLoc[0]) {
                    var tag = this.originalContent.substring(tagLoc[0] + tagLoc[2], tagLoc[0] + tagLoc[2] + tagLoc[1]);
                    if (tag.startsWith('</') ||
                        tag.endsWith('/>') ||
                        blockElements.includes(tag.split(' ')[0].split('<')[1].split('>')[0]) ||
                        !this.includeRequiredTag(i, highlightLoc, tag)) {
                        locInc[0] += tagLoc[1];
                    }
                }
                else if (highlightLoc[0] > tagLoc[0]) {
                    locInc[0] += tagLoc[1];
                }
            }
        }
        for (var i = 0; i < this.highlights.length; i++) {
            var highlight = this.highlights[i];
            if (highlight.highlighted) {
                var openTagLength = TextAnnotator.getOpenTagLength(highlightIdPattern, i, highlightClass);
                var closeTagLength = TextAnnotator.getCloseTagLength();
                var loc = highlight.loc;
                if (highlightLoc[0] >= loc[1]) {
                    locInc[0] += openTagLength + closeTagLength;
                    locInc[1] += openTagLength + closeTagLength;
                }
                else if (highlightLoc[0] < loc[1] && highlightLoc[0] > loc[0] && highlightLoc[1] > loc[1]) {
                    locInc[0] += openTagLength;
                    locInc[1] += openTagLength + closeTagLength;
                }
                else if (highlightLoc[0] <= loc[0] && highlightLoc[1] >= loc[1]) {
                    locInc[1] += openTagLength + closeTagLength;
                }
                else if (highlightLoc[0] < loc[0] && highlightLoc[1] > loc[0] && highlightLoc[1] < loc[1]) {
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
    TextAnnotator.createOpenTag = function (highlightIdPattern, highlightIndex, highlightClass) {
        return "<span id=\"" + (highlightIdPattern + highlightIndex) + "\" class=\"" + highlightClass + "\">";
    };
    TextAnnotator.createCloseTag = function () {
        return "</span>";
    };
    TextAnnotator.getOpenTagLength = function (highlightIdPattern, highlightIndex, highlightClass) {
        return TextAnnotator.createOpenTag(highlightIdPattern, highlightIndex, highlightClass).length;
    };
    TextAnnotator.getCloseTagLength = function () {
        return TextAnnotator.createCloseTag().length;
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
            abbreviations: null
        };
        return sbd_1["default"](text, options).map(function (raw) {
            var index = text.indexOf(raw);
            return { raw: raw, index: index };
        });
    };
    TextAnnotator.getBestSubstring = function (str, substr, threshold, lenRatio, caseSensitive, skipFirstRun) {
        var result = {};
        var similarity = skipFirstRun ? threshold : TextAnnotator.getSimilarity(str, substr, caseSensitive);
        if (similarity >= threshold) {
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
        return TextAnnotator.lcsLength(str1, str2) / str2.length;
    };
    TextAnnotator.lcsLength = function (firstSequence, secondSequence, caseSensitive) {
        function createArray(dimension) {
            var array = [];
            for (var i_2 = 0; i_2 < dimension; i_2++) {
                array[i_2] = [];
            }
            return array;
        }
        var firstString = caseSensitive ? firstSequence : firstSequence.toLowerCase();
        var secondString = caseSensitive ? secondSequence : secondSequence.toLowerCase();
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
            else if (Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]) === lcsMatrix[i - 1][j]) {
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
exports["default"] = TextAnnotator;
//# sourceMappingURL=text-annotator.js.map