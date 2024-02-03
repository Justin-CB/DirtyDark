/****************************************************************************\
 *                             Begin General Functions                      *
\****************************************************************************/

/* This converts any color string into an array containing the rgba values of *
 * said string.                                                               */
function parseColor(color, reparse)
{
    var rgb;
    computationDiv.style.color = color;
    color = getComputedStyle(computationDiv).color;
    if (rgb = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)) {
        return [+rgb[1], +rgb[2], +rgb[3], 1];
    }
    else if (
        rgb = color.match(
            /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d*%?)\)$/i
        )) {
        return [+rgb[1], +rgb[2], +rgb[3], rgb[4]];
    }
    else if (color == "transparent") {
        return [0, 0, 0, 0];
    }
    else {
        return [0, 0, 0, 1];
    }
}

/* This converts any color string into an array containing the rgba values of *
 * said string.  It pulls it from a cached map b/c webapps can have thousands *
 * of rules, which causes processing to take so long it crashes the page.     */
function convertColor(color)
{
    var parsed;
    if (colorsMap.has(color)) {
        parsed = colorsMap.get(color);
    }
    else {
        parsed = parseColor(color, true);
        colorsMap.set(color, parsed);
    }
    return parsed;
}

function splitBG(bg)
{
    computationDiv.style.background = bg;
    return getComputedStyle(computationDiv);
}

/* Straight invert a color */
function trueInvert(color)
{
    color[0] = 255 - color[0];
    color[1] = 255 - color[1];
    color[2] = 255 - color[2];
    return color;
}

/* Invert a color's brightness w/o changing its chroma */
function brightnessInvert(color)
{
    return [
        255 - ((color[1] + color[2])/2),
        255 - ((color[0] + color[2])/2),
        255 - ((color[1] + color[2])/2),
        color[3]
    ];
}

function toRGBa(color)
{
    return "rgba(" + color + ')';
}

function fixInvertColor(fg,color)
{
    var sum;
    /*sum of midpoint color = (255 * 3 / 2) = 382.5*/
    color = convertColor(color);
    sum = color[0] + color[1] + color[2];
    if (fg && sum < 382.5 /* <- midpoint */) {
        color = invert(color, sum);
    }
    else if (!fg && sum > 382.5 /* <- midpoint */) {
        color = invert(color, sum);
    }
    return toRGBa(color);
}

function fixConstColor(fg,color)
{
    if (fg) {
        return "#fff";
    }
    else {
        return "#000";
    }
}

function fixInvertBackgroundImage(im)
{
    /* Just strip out gradients for now.  We'd have to parse them ourselves *
     * to invert them.                                                      */
    im = im.replace(
        /[A-z\-]+gradient\(([^\(\)]*\([^\(\)]*\)[^\(\)]*)*\),?/i, ""
    );
    if (im.length > 0) {
        return im;
    }
    else {
        return "none";
    }
    return "none";
}

function fixConstBackgroundImage(im)
{
    return "none";
}

/****************************************************************************\
 *                          End General Functions                           *
 ****************************************************************************
 *                  Begin Inline Style Handling Functions                   *
\****************************************************************************/

function darken(elem)
{
    var bg;
    if (elem.style) {
        if (elem.style.color) {
            elem.style.color = fixColor(true, elem.style.color);
        }
        if (elem.style.background) {
            bg = splitBG(elem.style.background);
            if (bg.backgroundColor) {
                elem.style.backgroundColor = bg.backgroundColor;
            }
            if (bg.backgroundImage) {
                elem.style.backgroundImage = bg.backgroundImage;
            }
            // The background settings we don't care about shouldn't be updated.
        }
        if (elem.style.backgroundColor) {
            elem.style.backgroundColor = fixColor(
                false, elem.style.backgroundColor
            );
        }
        if (elem.style.backgroundImage) {
            elem.style.backgroundImage = fixBackgroundImage(
                elem.style.backgroundImage
            );
        }
    }
}

function observeBody(records, observer)
{
    var i;
    var j;
    var elems;
    for (i in records) {
        if (
            records[i].type == "childList" && records[i].addedNodes.length > 0
        ) {
            for (j in records[i].addedNodes) {
                if (records[i].addedNodes[j] instanceof HTMLElement) {
                    darken(records[i].addedNodes[j]);
                }
            }
        }
        else if (records[i].type == "attributes") {
            darken(records[i].target);
        }
    }
}

/****************************************************************************\
 *                   End Inline Style Handling Functions                    *
 ****************************************************************************
 *                   Begin Style Sheet Handling Functions                   *
\****************************************************************************/

function handleShorthandBG(bg, bgcolor)
{
    /* The shorthand property has just these 2 rules (that we care about):
         * backgroundSize must be after backgroundPosition
         * backgroundOrigin must be before backgroundClip
     */
    bg = splitBG(bg);
    ret = "";
    if (bg.backgroundColor) {
        ret += ' ' + backgroundColor;
    }
    if (bg.backgroundImage) {
        ret += ' ' + backgroundImage;
        if (!bg.backgroundColor && !bgcolor) {
            ret += " #000";
        }
    }
    /* We don't care about these rules but need to handle them anyways b/c *
     * they're part of the shorthand.                                      */
    if (bg.backgroundPosition) {
        ret += ' ' + bg.backgroundPosition;
    }
    /* Size after Position */
    if (bg.backgroundSize) {
        ret += ' ' + bg.backgroundSize;
    }
    /* Origin before Clip */
    if (bg.backgroundOrigin) {
        ret += ' ' + bg.backgroundOrigin;
    }
    if (bg.backgroundClip) {
        ret += ' ' + bg.backgroundClip;
    }
    if (bg.backgroundRepeat) {
        ret += ' ' + bg.backgroundRepeat;
    }
    if (bg.backgroundAttachment) {
        ret += ' ' + bg.backgroundAttachment;
    }
    return ret;
}

function handleSheet(sheet)
{
    var replaced = 0;
    var checked = 0;
    var skipped = 0;
    var rules = sheet.cssRules;
    var i;
    var j;
    var property;
    var value;
    var priority;
    var rule;
    for (i = 0; i < rules.length; i ++) {
        if (
            (rules[i] instanceof CSSStyleRule) && !processedRules.has(rules[i])
        ) {
            if (
                rules[i].style.color ||
                rules[i].style.backgroundColor ||
                rules[i].style.backgroundImage ||
                rules[i].style.background
            ) {
                rule = rules[i].selectorText + '{'
                for (j = 0; j < rules[i].style.length; j ++) {
                    property = rules[i].style.item(j);
                    value = rules[i].style.getPropertyValue(property);
                    priority = rules[i].style.getPropertyPriority(property);
                    if (priority != "") {
                        priority = " !" + priority;
                    }
                    if (property == "color") {
                        value = fixColor(true, rules[i].style.color)
                    }
                    else if (property == "background-color") {
                        value = fixColor(false, rules[i].style.backgroundColor);
                    }
                    else if (property == "background-image") {
                        value =
                            fixBackgroundImage(rules[i].style.backgroundImage);
                        if (!rules[i].style.backgroundColor) {
                            rule += "background-color: #000;";
                        }
                    }
                    else if (property == "background") {
                        value = handleShorthandBG(
                            rules[i].style.background,
                            rules[i].style.backgroundColor
                        );
                    }
                    rule += property + ':' + value + priority + ';';
                }
                rule += '}';
                //console.log("Replaced " + rules[i].cssText + " with " + rule);
                sheet.deleteRule(i);
                sheet.insertRule(rule,i);
                replaced ++;
            }
            else {
                checked ++;
            }
            processedRules.set(rules[i],true);
        }
        else {
             skipped ++;
        }
    }
    /*console.log(
        "Replaced " + replaced + " rules, checked " + checked +
        " additional rules, and skipped " + skipped + " rules"
    );*/
}

/* If the stylesheet originated from a foreign domain, we can't access it     *
 * thru  JavaScript normally for "security" reasons.  I'm not sure how        *
 * blocking this  makes anything more secure, since JavaScript on the page    *
 * can change its style anyways; it just makes it slightly less convenient.   *
 * Since we're an extension, we can simply do a fetch & get the stylesheet,   *
 * then delete all the rules we don't care about.  We should even be able to  *
 * get stylesheets that are @included since they're in document.styleSheets   *
 * as well.  Our rules should override the actual stylesheet's rules b/c ours *
 * come later in the document & have exactly the same specicifity otherwise.  */
async function replaceSheet(sheet)
{
    var i;
    var deleted = 0;
    var url = sheet.href;
    var css;
    var resp;
    var remove;
    if (!url) {
        console.log("Trying to replace CSS sheet w/o a URL");
        return;
    }
    try {
        resp = await fetch(url);
        if (resp.ok) {
            css = document.createElement("style");
            css.type = "text/css";
            document.head.appendChild(css);
            css.disabled = true;
            css.textContent = await resp.text();
            /* Only keep Style & Grouping rules (some other rules could be *
             * defined w/relative URLs, which could break things).         */
            for (i = 0; i < css.sheet.cssRules.length; i ++) {
                if (!(
                    css.sheet.cssRules[i] instanceof CSSStyleRule ||
                    css.sheet.cssRules[i] instanceof CSSGroupingRule
                )) {
                    css.sheet.deleteRule(i);
                    i--;
                }
            }
            css.class = "DirtyDarkReplacedSheet";
            handleSheet(css.sheet);
            css.disabled = false;
        }
    }
    catch (e) {
        console.log("Failed to load " + url + " : " + e);
        return;
    }
}

function handleSheetTryCatch(sheet)
{
    try {
        if (!replacedSheets.has(sheet)) {
            handleSheet(sheet);
        }
    }
    catch (e) {
        /* TODO: Query configuration */
        console.log("Failed Parsing sheet: " + e);
        replaceSheet(sheet);
        replacedSheets.set(sheet, true);
    }
}

/* Handle all stylesheets */
function handleStyles()
{
    var i;
    for (i = 0; i < document.styleSheets.length; i ++) {
        if (
            document.styleSheets[i].ownerNode instanceof HTMLStyleElement &&
            document.styleSheets[i].class != "DirtyDarkReplacedSheet"
        ) {
            styleSheetMutationObserver.observe(
                document.styleSheets[i].ownerNode,
                {childList:true,subtree:true,characterData:true}
            );
        }
        handleSheetTryCatch(document.styleSheets[i]);
    }
}

function pollLinkedSheets()
{
    var i;
    for (i = 0; i < document.styleSheets.length; i ++) {
        if (document.styleSheets[i].ownerNode instanceof HTMLLinkElement) {
            handleSheetTryCatch(document.styleSheets[i]);
        }
    }
}

function handleUnwindingToStyle(elem)
{
    while (!(elem instanceof HTMLStyleElement) && elem.parentElement) {
        elem = elem.parentElement;
    }
    if (elem instanceof HTMLStyleElement) {
        handleSheet(elem.sheet);
    }
}

function observeStyleSheetMutation(records, observer)
{
    for (i in records) {
        if (records[i].type == "childList") {
            for (j in records[i].addedNodes) {
                handleUnwindingToStyle(records[i].addedNodes[j]);
            }
        }
        else if (records[i].type == "characterData") {
            handleUnwindingToStyle(records[i].target);
        }
    }
}

function observeHead(records, observer)
{
    for (i in records) {
        if (records[i].type == "childList") {
            for (j in records[i].addedNodes) {
                if (
                    (
                        records[i].addedNodes[j] instanceof HTMLLinkElement &&
                        records[i].addedNodes[j].sheet
                    ) ||
                    (
                        records[i].addedNodes[j] instanceof HTMLStyleElement &&
                        records[i].addedNodes[j].class !=
                            "DirtyDarkReplacedSheet"
                    )
                ) {
                    handleSheet(records[i].addedNodes[j].sheet);
                }
            }
        }
    }
}

/****************************************************************************\
 *                    End Style Sheet Handling Functions                    *
 ****************************************************************************
 *                    Begin Main/Configuration Functions                    *
\****************************************************************************/
/* Global Variables: */
var styleSheetMutationObserver;
var colorsMap = new Map();
var replacedSheets = new Map();
var processedRules = new Map();
var computationDiv;
/* Global Function Variables: */
var invert;
var fixColor;
var fixBackgroundImage;
/* The main function: */
function main()
{
    var bodyObserver = new MutationObserver(observeBody);
    var headObserver = new MutationObserver(observeHead);
    var i;
    var elems;
    computationDiv = document.createElement("div");
    computationDiv.style.display = "none";
    document.body.appendChild(computationDiv);
    styleSheetMutationObserver =
        new MutationObserver(observeStyleSheetMutation);
    /* TODO: replace w/settings */
    invert = brightnessInvert;
    fixColor = fixInvertColor;
    fixBackgroundImage = fixInvertBackgroundImage;
    bodyObserver.observe(
        document.body,
        {childList:true,attributes:true,attributeFilter:["style"],subtree:true}
    );
    headObserver.observe(document.head, {childList:true,subtree:true});
    /* Poll linked sheets b/c there's no observer for that: */
    setInterval(pollLinkedSheets, 500);

    handleStyles();

    elems = document.querySelectorAll("*[style]");
    for (i = 0; i < elems.length; i ++) {
        darken(elems[i]);
    }
}

/* TODO: replace w/reading settings whether to run */
main();
