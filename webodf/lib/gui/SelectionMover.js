/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global runtime, core, gui, XMLSerializer*/
runtime.loadClass("core.Cursor");
runtime.loadClass("core.PositionIterator");
runtime.loadClass("core.PositionFilter");
runtime.loadClass("core.LoopWatchDog");

/**
 * This class modifies the selection in different ways.
 * @constructor
 * @param {core.Cursor} cursor
 * @param {!Node} rootNode
 * @param {!Function=} onCursorAdd
 * @param {!function(?Element,!number):undefined=} onCursorRemove
 */
gui.SelectionMover = function SelectionMover(cursor, rootNode, onCursorAdd, onCursorRemove) {
    "use strict";
    var self = this,
        selection = cursor.getSelection(),
        positionIterator;
    function doMove(steps, extend, move) {
        var left = steps;
        // assume positionIterator reflects current state
        // positionIterator.setPosition(selection.focusNode, selection.focusOffset);
        onCursorRemove = onCursorRemove || self.adaptToCursorRemoval;
        cursor.remove(onCursorRemove);
        while (left > 0 && move()) {
            left -= 1;
        }
        if (steps - left > 0) {
            selection.collapse(positionIterator.container(),
                    positionIterator.offset());
        }
        cursor.updateToSelection(onCursorRemove);
        onCursorAdd(cursor.getNode());
        return steps - left;
    }
    /**
     * Move selection forward one position.
     * @param {!number} steps
     * @param {boolean=} extend true if range is to be expanded from the current
     *                         point
     * @return {!number}
     **/
    this.movePointForward = function (steps, extend) {
        return doMove(steps, extend, positionIterator.nextPosition);
    };
    /**
     * Move selection forward one position.
     * @param {boolean=} extend true if range is to be expanded from the current
     *                         point
     * @return {!number}
     **/
    this.movePointBackward = function (steps, extend) {
        return doMove(steps, extend, positionIterator.previousPosition);
    };
/*
    this.moveLineForward = function (extend) {
        if (selection.modify) {
            // TODO add a way to
            selection.modify(extend ? "extend" : "move", "forward", "line");
        } else {
            doMove(extend, moveCursorDown);
        }
    };
    this.moveLineBackward = function (extend) {
        if (selection.modify) {
            selection.modify(extend ? "extend" : "move", "backward", "line");
        } else {
            doMove(extend, function () {
            });
        }
    };
*/
    /**
     * @param {!number} steps
     * @param {!core.PositionFilter} filter
     * @return {!number}
     */
    function countForwardSteps(steps, filter) {
        var c = positionIterator.container(),
            o = positionIterator.offset(),
            stepCount = 0,
            count = 0;
        while (steps > 0 && positionIterator.nextPosition()) {
            stepCount += 1;
            if (filter.acceptPosition(positionIterator) === 1) {
                count += stepCount;
                stepCount = 0;
                steps -= 1;
            }
        }
        positionIterator.setPosition(c, o);
        return count;
    }
    /**
     * @param {!number} steps
     * @param {!core.PositionFilter} filter
     * @return {!number}
     */
    function countBackwardSteps(steps, filter) {
        var c = positionIterator.container(),
            o = positionIterator.offset(),
            stepCount = 0,
            count = 0;
        while (steps > 0 && positionIterator.previousPosition()) {
            stepCount += 1;
            if (filter.acceptPosition(positionIterator) === 1) {
                count += stepCount;
                stepCount = 0;
                steps -= 1;
            }
        }
        positionIterator.setPosition(c, o);
        return count;
    }
    function getOffset(el) {
        var x = 0, y = 0;
        while (el && el.nodeType === 1) {//!isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
            x += el.offsetLeft - el.scrollLeft;
            y += el.offsetTop - el.scrollTop;
            el = el.parentNode;//offsetParent;
        }
        return { top: y, left: x };
    }
    /**
     * @param {!number} lines
     * @param {!core.PositionFilter} filter
     * @return {!number}
     */
    function countLineUpSteps(lines, filter) {
        var c = positionIterator.container(),
            o = positionIterator.offset(),
            span = cursor.getNode().firstChild,
            stepCount = 0,
            count = 0,
            offset = span.offsetTop,
            i;
        onCursorRemove = onCursorRemove || self.adaptToCursorRemoval;
        while (lines > 0 && positionIterator.previousPosition()) {
            stepCount += 1;
            if (filter.acceptPosition(positionIterator) === 1) {
                offset = span.offsetTop;
                selection.collapse(positionIterator.container(),
                        positionIterator.offset());
                cursor.updateToSelection(onCursorRemove);
                offset = span.offsetTop; // for now, always accept
                if (offset !== span.offsetTop) {
                    count += stepCount;
                    stepCount = 0;
                    lines -= 1;
                }
            }
        }
        positionIterator.setPosition(c, o);
        selection.collapse(positionIterator.container(),
                positionIterator.offset());
        cursor.updateToSelection(onCursorRemove);
        return count;
    }
    /**
     * @param {!number} lines
     * @param {!core.PositionFilter} filter
     * @return {!number}
     */
    function countLineDownSteps(lines, filter) {
        var c = positionIterator.container(),
            o = positionIterator.offset(),
            span = cursor.getNode().firstChild,
            stepCount = 0,
            count = 0,
            offset = span.offsetTop,
            i;
        onCursorRemove = onCursorRemove || self.adaptToCursorRemoval;
        while (lines > 0 && positionIterator.nextPosition()) {
            stepCount += 1;
            if (filter.acceptPosition(positionIterator) === 1) {
                offset = span.offsetTop;
                selection.collapse(positionIterator.container(),
                        positionIterator.offset());
                cursor.updateToSelection(onCursorRemove);
                offset = span.offsetTop; // for now, always accept
                if (offset !== span.offsetTop) {
                    count += stepCount;
                    stepCount = 0;
                    lines -= 1;
                }
            }
        }
        positionIterator.setPosition(c, o);
        selection.collapse(positionIterator.container(),
                positionIterator.offset());
        cursor.updateToSelection(onCursorRemove);
        return count;
    }
    /**
     * Calculate node offset.
     * @param {!Node} node
     * @param {!Node} container
     * @return {!number}
     */
    function getPositionInContainingNode(node, container) {
        var offset = 0,
            n;
        while (node.parentNode !== container) {
            node = node.parentNode;
        }
        n = container.firstChild;
        while (n !== node) {
            offset += 1;
            n = n.nextSibling;
        }
        return offset;
    }
    /**
     * Return a number > 0 when point 1 precedes point 2. Return 0 if the points
     * are equal. Return < 0 when point 2 precedes point 1.
     * @param {!Node} c1
     * @param {!number} o1
     * @param {!Node} c2
     * @param {!number} o2
     * @return {!number}
     */
    function comparePoints(c1, o1, c2, o2) {
        if (c1 === c2) {
            return o2 - o1;
        }
        var comparison = c1.compareDocumentPosition(c2);
        if (comparison === 2) { // DOCUMENT_POSITION_PRECEDING
            comparison = -1;
        } else if (comparison === 4) { // DOCUMENT_POSITION_FOLLOWING
            comparison = 1;
        } else if (comparison === 10) { // DOCUMENT_POSITION_CONTAINS
            // c0 contains c2
            o1 = getPositionInContainingNode(c1, c2);
            comparison = (o1 < o2) ? 1 : -1;
        } else { // DOCUMENT_POSITION_CONTAINED_BY
            o2 = getPositionInContainingNode(c2, c1);
            comparison = (o2 < o1) ? -1 : 1;
        }
        return comparison;
    }
    /**
     * @param {!Element} element
     * @param {!number} offset
     * @param {!core.PositionFilter} filter
     * @return {!number}
     */
    function countStepsToPosition(element, offset, filter) {
        // first figure out how to get to the element
        // really dumb/inefficient implementation
        var c = positionIterator.container(),
            o = positionIterator.offset(),
            steps = 0,
            watch = new core.LoopWatchDog(1000),
            comparison;

        // the iterator may interpret the positions as given by the range
        // differently than the dom positions, so we normalize them by calling
        // setPosition with these values
        positionIterator.setPosition(element, offset);
        element = positionIterator.container();
        offset = positionIterator.offset();
        positionIterator.setPosition(c, o);

        comparison = comparePoints(element, offset, c, o);
        if (comparison < 0) {
            while (positionIterator.nextPosition()) {
                watch.check();
                if (filter.acceptPosition(positionIterator) === 1) {
                    steps += 1;
                }
                if (positionIterator.container() === element) {
                    if (positionIterator.offset() === offset) {
                        positionIterator.setPosition(c, o);
                        return steps;
                    }
                }
            }
            positionIterator.setPosition(c, o);
        } else if (comparison > 0) {
            while (positionIterator.previousPosition()) {
                watch.check();
                if (filter.acceptPosition(positionIterator) === 1) {
                    steps -= 1;
                }
                if (positionIterator.container() === element) {
                    if (positionIterator.offset() === offset) {
                        positionIterator.setPosition(c, o);
                        return steps;
                    }
                }
            }
            positionIterator.setPosition(c, o);
        }
        return steps;
    }

    this.getStepCounter = function () {
        return {
            countForwardSteps: countForwardSteps,
            countBackwardSteps: countBackwardSteps,
            countLineDownSteps: countLineDownSteps,
            countLineUpSteps: countLineUpSteps,
            countStepsToPosition: countStepsToPosition
        };
    };
    /**
     * @param {?Element} nodeAfterCursor
     * @param {!number} textNodeIncrease
     * @return {undefined}
     */
    this.adaptToCursorRemoval = function (nodeAfterCursor, textNodeIncrease) {
        if (textNodeIncrease === 0 || nodeAfterCursor === null
                || nodeAfterCursor.nodeType !== 3) {
            return;
        }
        var c = positionIterator.container();
        if (c === nodeAfterCursor) {
            positionIterator.setPosition(c,
                    positionIterator.offset() + textNodeIncrease);
        }
    };
    /**
     * @param {!Element} cursorNode
     * @return {undefined}
     */
    this.adaptToInsertedCursor = function (cursorNode) {
        var c = positionIterator.container(), t;
        if (c.nodeType !== 3) {
            return;
        }
        if (c.previousSibling === cursorNode) {
            t = cursorNode.previousSibling && cursorNode.previousSibling.length;
            if (t > 0) {
                positionIterator.setPosition(c, positionIterator.offset() - t);
            }
        }
    };
    function init() {
        positionIterator = gui.SelectionMover.createPositionIterator(rootNode);
        // put the cursor at the start of the rootNode
        selection.collapse(positionIterator.container(),
                positionIterator.offset());

        onCursorRemove = onCursorRemove || self.adaptToCursorRemoval;
        onCursorAdd = onCursorAdd || self.adaptToInsertedCursor;

        cursor.updateToSelection(onCursorRemove);
    }
    init();
};
/**
 * @param {!Node} rootNode
 * @return {!core.PositionIterator}
 */
gui.SelectionMover.createPositionIterator = function (rootNode) {
    "use strict";
    /**
     * @constructor
     * @extends NodeFilter
      */
    function CursorFilter() {
        /**
         * @param {!Node} node
         * @return {!number}
         */
        this.acceptNode = function (node) {
            if (node.namespaceURI === "urn:webodf:names:cursor") {
                return 2;
            }
            return 1;
        };
    }
    var filter = new CursorFilter();
    return new core.PositionIterator(rootNode, 5, filter, false);
};
(function () {
    "use strict";
    return gui.SelectionMover;
}());
