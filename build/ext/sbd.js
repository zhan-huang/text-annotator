"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// the sbd lib was modified from https://github.com/Tessmore/sbd
var abbreviations = [];
var englishAbbreviations = [
    'al',
    'adj',
    'assn',
    'Ave',
    'BSc',
    'MSc',
    'Cell',
    'Ch',
    'Co',
    'cc',
    'Corp',
    'Dem',
    'Dept',
    'ed',
    'eg',
    'Eq',
    'Eqs',
    'est',
    'est',
    'etc',
    'Ex',
    'ext',
    'Fig',
    'fig',
    'Figs',
    'figs',
    'i.e',
    'ie',
    'Inc',
    'inc',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Sept',
    'Oct',
    'Nov',
    'Dec',
    'jr',
    'mi',
    'Miss',
    'Mrs',
    'Mr',
    'Ms',
    'Mol',
    'mt',
    'mts',
    'no',
    'Nos',
    'PhD',
    'MD',
    'BA',
    'MA',
    'MM',
    'pl',
    'pop',
    'pp',
    'Prof',
    'Dr',
    'pt',
    'Ref',
    'Refs',
    'Rep',
    'repr',
    'rev',
    'Sec',
    'Secs',
    'Sgt',
    'Col',
    'Gen',
    'Rep',
    'Sen',
    'Gov',
    'Lt',
    'Maj',
    'Capt',
    'St',
    'Sr',
    'sr',
    'Jr',
    'jr',
    'Rev',
    'Sun',
    'Mon',
    'Tu',
    'Tue',
    'Tues',
    'Wed',
    'Th',
    'Thu',
    'Thur',
    'Thurs',
    'Fri',
    'Sat',
    'trans',
    'Univ',
    'Viz',
    'Vol',
    'vs',
    'v',
];
var setAbbreviations = function (abbr) {
    if (abbr) {
        abbreviations = abbr;
    }
    else {
        abbreviations = englishAbbreviations;
    }
};
var isCapitalized = function (str) {
    return /^[A-Z][a-z].*/.test(str) || isNumber(str);
};
var isSentenceStarter = function (str) {
    return isCapitalized(str) || /``|"|'/.test(str.substring(0, 2));
};
var isCommonAbbreviation = function (str) {
    return ~abbreviations.indexOf(str.replace(/\W+/g, ''));
};
var isTimeAbbreviation = function (word, next) {
    if (word === 'a.m.' || word === 'p.m.') {
        var tmp = next.replace(/\W+/g, '').slice(-3).toLowerCase();
        if (tmp === 'day') {
            return true;
        }
    }
    return false;
};
var isDottedAbbreviation = function (word) {
    var matches = word.replace(/[()[\]{}]/g, '').match(/(.\.)*/);
    return matches && matches[0].length > 0;
};
var isCustomAbbreviation = function (str) {
    if (str.length <= 3) {
        return true;
    }
    return isCapitalized(str);
};
var isNameAbbreviation = function (wordCount, words) {
    if (words.length > 0) {
        if (wordCount < 5 && words[0].length < 6 && isCapitalized(words[0])) {
            return true;
        }
        var capitalized = words.filter(function (str) {
            return /[A-Z]/.test(str.charAt(0));
        });
        return capitalized.length >= 3;
    }
    return false;
};
var isNumber = function (str, dotPos) {
    if (dotPos) {
        str = str.slice(dotPos - 1, dotPos + 2);
    }
    return !isNaN(str);
};
var isPhoneNr = function (str) {
    return str.match(/^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/);
};
var isURL = function (str) {
    return str.match(/[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/);
};
var isConcatenated = function (word) {
    var i = 0;
    if ((i = word.indexOf('.')) > -1 ||
        (i = word.indexOf('!')) > -1 ||
        (i = word.indexOf('?')) > -1) {
        var c = word.charAt(i + 1);
        if (c.match(/[a-zA-Z].*/)) {
            return [word.slice(0, i + 1), word.slice(i + 1)];
        }
    }
    return false;
};
var isBoundaryChar = function (word) {
    return word === '.' || word === '!' || word === '?';
};
var sanitizeHtml = function (text) {
    if ((typeof text == 'string' || text instanceof String) &&
        typeof document !== 'undefined') {
        var $div = document.createElement('DIV');
        $div.innerHTML = text;
        text = ($div.textContent || '').trim();
    }
    else if (typeof text === 'object' && text.textContent) {
        text = (text.textContent || '').trim();
    }
    return text;
};
var endsWithChar = function (word, c) {
    if (c.length > 1) {
        return c.indexOf(word.slice(-1)) > -1;
    }
    return word.slice(-1) === c;
};
var endsWith = function (word, end) {
    return word.slice(word.length - end.length) === end;
};
function getSentences(text, user_options) {
    var newline_placeholder = ' @~@ ';
    var newline_placeholder_t = newline_placeholder.trim();
    var whiteSpaceCheck = new RegExp('\\S', '');
    var addNewLineBoundaries = new RegExp('\\n+|[-#=_+*]{4,}', 'g');
    var splitIntoWords = new RegExp('\\S+|\\n', 'g');
    if (!text || typeof text !== 'string' || !text.length) {
        return [];
    }
    if (!whiteSpaceCheck.test(text)) {
        return [];
    }
    var options = {
        newline_boundaries: false,
        html_boundaries: false,
        html_boundaries_tags: ['p', 'div', 'ul', 'ol'],
        sanitize: false,
        allowed_tags: false,
        preserve_whitespace: false,
        abbreviations: null,
    };
    if (typeof user_options === 'boolean') {
        options.newline_boundaries = true;
    }
    else {
        for (var k in user_options) {
            options[k] = user_options[k];
        }
    }
    setAbbreviations(options.abbreviations);
    if (options.newline_boundaries) {
        text = text.replace(addNewLineBoundaries, newline_placeholder);
    }
    if (options.html_boundaries) {
        var html_boundaries_regexp = '(<br\\s*\\/?>|<\\/(' + options.html_boundaries_tags.join('|') + ')>)';
        var re = new RegExp(html_boundaries_regexp, 'g');
        text = text.replace(re, '$1' + newline_placeholder);
    }
    if (options.sanitize || options.allowed_tags) {
        if (!options.allowed_tags) {
            options.allowed_tags = [''];
        }
        text = sanitizeHtml(text, { allowedTags: options.allowed_tags });
    }
    var words;
    var tokens;
    if (options.preserve_whitespace) {
        tokens = text.split(/(<br\s*\/?>|\S+|\n+)/);
        words = tokens.filter(function (token, ii) {
            return ii % 2;
        });
    }
    else {
        words = text.trim().match(splitIntoWords);
    }
    var wordCount = 0;
    var index = 0;
    var temp = [];
    var sentences = [];
    var current = [];
    if (!words || !words.length) {
        return [];
    }
    var tokenIndexInc = 0;
    for (var i = 0, L = words.length; i < L; i++) {
        wordCount++;
        current.push(words[i]);
        if (~words[i].indexOf(',')) {
            wordCount = 0;
        }
        if (isBoundaryChar(words[i]) ||
            endsWithChar(words[i], '?!') ||
            words[i] === newline_placeholder_t) {
            if ((options.newline_boundaries || options.html_boundaries) &&
                words[i] === newline_placeholder_t) {
                current.pop();
            }
            sentences.push(current);
            wordCount = 0;
            current = [];
            continue;
        }
        if (endsWithChar(words[i], '"') || endsWithChar(words[i], '”')) {
            words[i] = words[i].slice(0, -1);
            index = i * 2 + 1;
        }
        if (endsWithChar(words[i], '.')) {
            if (i + 1 < L) {
                if (words[i].length === 2 && isNaN(words[i].charAt(0))) {
                    continue;
                }
                if (isCommonAbbreviation(words[i])) {
                    continue;
                }
                if (isSentenceStarter(words[i + 1])) {
                    if (isTimeAbbreviation(words[i], words[i + 1])) {
                        continue;
                    }
                    if (isNameAbbreviation(wordCount, words.slice(i, 6))) {
                        continue;
                    }
                    if (isNumber(words[i + 1])) {
                        if (isCustomAbbreviation(words[i])) {
                            continue;
                        }
                    }
                }
                else {
                    if (endsWith(words[i], '..')) {
                        continue;
                    }
                    if (isDottedAbbreviation(words[i])) {
                        continue;
                    }
                    if (isNameAbbreviation(wordCount, words.slice(i, 5))) {
                        continue;
                    }
                }
            }
            sentences.push(current);
            current = [];
            wordCount = 0;
            continue;
        }
        if ((index = words[i].indexOf('.')) > -1) {
            if (isNumber(words[i], index)) {
                continue;
            }
            if (isDottedAbbreviation(words[i])) {
                continue;
            }
            if (isURL(words[i]) || isPhoneNr(words[i])) {
                continue;
            }
        }
        var match = isConcatenated(words[i]);
        if (match) {
            temp = match;
            current.pop();
            current.push(temp[0]);
            sentences.push(current);
            if (options.preserve_whitespace) {
                tokens.splice(i * 2 + 1 + tokenIndexInc, 1, temp[0], '', temp[1]);
                tokenIndexInc += 2;
            }
            current = [];
            wordCount = 0;
            current.push(temp[1]);
        }
    }
    if (current.length) {
        sentences.push(current);
    }
    var result = [];
    var sentence = '';
    sentences = sentences.filter(function (s) {
        return s.length > 0;
    });
    for (var i2 = 0; i2 < sentences.length; i2++) {
        if (options.preserve_whitespace &&
            !options.newline_boundaries &&
            !options.html_boundaries) {
            var tokenCount = sentences[i2].length * 2;
            if (i2 === 0) {
                tokenCount += 1;
            }
            sentence = tokens.splice(0, tokenCount).join('');
        }
        else {
            sentence = sentences[i2].join(' ');
        }
        if (sentences[i2].length === 1 &&
            sentences[i2][0].length < 4 &&
            sentences[i2][0].indexOf('.') > -1) {
            if (sentences[i2 + 1] && sentences[i2 + 1][0].indexOf('.') < 0) {
                sentence += ' ' + sentences[i2 + 1].join(' ');
                i2++;
            }
        }
        result.push(sentence);
    }
    return result;
}
exports.default = getSentences;
