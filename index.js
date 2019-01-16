const pdfPrintedPageBreak = "survey_pdf_break";
function getPosition(el) {
  var res = 0;
  while (el) {
    if (el.tagName == "BODY") {
      var yScroll = el.scrollTop || document.documentElement.scrollTop;
      res += el.offsetTop - yScroll + el.clientTop;
    } else {
      res += el.offsetTop - el.scrollTop + el.clientTop;
    }
    el = el.offsetParent;
  }
  return res;
}
function getElementOffset(el, rootEl) {
  var rootElTop = getPosition(rootEl);
  var elTop = getPosition(el);
  var res = Math.abs(rootElTop - elTop);
  return res + el.offsetHeight;
}
function isBottomRow(el) {
  const className = "sv_row";
  var isRow = !!el.className && el.className.indexOf(className) > -1;
  if (!isRow) return false;
  return el.getElementsByClassName(className).length == 0;
}
function getNextElement(el) {
  if (!el) return null;
  if (!!el.nextElementSibling) return el.nextElementSibling;
  return getNextElement(el.parentElement);
}
function findElementOnBreak(element, height) {
  var curElement = element;
  var bottomRowCounter = 0;
  while (!!curElement) {
    var isCurElementBottomRow = isBottomRow(curElement);
    if (isCurElementBottomRow) {
      bottomRowCounter++;
    }
    if (
      curElement.offsetHeight > 0 &&
      getElementOffset(curElement, element) > height
    ) {
      if (isCurElementBottomRow) {
        return bottomRowCounter > 1 ? curElement : getNextElement(curElement);
      }
      if (!curElement.firstElementChild) return curElement;
      curElement = curElement.firstElementChild;
    } else {
      curElement = getNextElement(curElement);
    }
  }
  return curElement;
}
function cloneAttributes(element, sourceNode) {
  var attr;
  var attributes = Array.prototype.slice.call(sourceNode.attributes);
  while ((attr = attributes.pop())) {
    element.setAttribute(attr.nodeName, attr.nodeValue);
  }
}
function doElementBreak(el, firstChild) {
  var parentEl = el.parentElement;
  var newParent = document.createElement(parentEl.tagName);
  cloneAttributes(newParent, parentEl);
  var childIndex = Array.prototype.indexOf.call(parentEl.children, el);
  if (childIndex < 0) return null;
  if (!!firstChild) {
    newParent.appendChild(firstChild);
    childIndex++;
  }
  var movedChildren = [];
  for (var i = childIndex; i < parentEl.children.length; i++) {
    movedChildren.push(parentEl.children[i]);
  }
  for (var i = 0; i < movedChildren.length; i++) {
    newParent.appendChild(movedChildren[i]);
  }
  return newParent;
}
function doPageBreak(rootElement, el) {
  var newRoot = null;
  while (el != rootElement) {
    var parentEl = el.parentElement;
    newRoot = doElementBreak(el, newRoot);
    if (!newRoot) return newRoot;
    el = parentEl;
  }
  return newRoot;
}
function createSurveyWithPrintedPages(
  survey,
  surveyElement,
  width,
  height,
  renderSurveyFunction
) {
  var json = survey.toJSON();
  var printedSurveyElement = document.createElement("div");
  printedSurveyElement.className = "printed-survey-element";
  surveyElement.appendChild(printedSurveyElement);
  surveyElement.style.width = width + "px";

  var printedSurvey = new Survey.Model(json);

  printedSurvey.onAfterRenderSurvey.add(function(survey, options) {
    var rootElement = printedSurveyElement.parentElement;
    printedSurveyElement.className += " " + pdfPrintedPageBreak;
    setTimeout(function() {
      //debugger;
      while (
        !!printedSurveyElement &&
        printedSurveyElement.offsetHeight > height
      ) {
        var el = findElementOnBreak(printedSurveyElement, height);
        if (!el) break;
        printedSurveyElement = doPageBreak(printedSurveyElement, el);
        /*
          var separator = document.createElement("div");
          separator.innerHTML = "<hr>";
          rootElement.appendChild(separator);
          */
        rootElement.appendChild(printedSurveyElement);
      }
    }, 0);
  });
  printedSurvey.data = survey.data;
  printedSurvey.mode = "display";
  printedSurvey.isSinglePage = true;
  printedSurvey.showProgressBar = "none";
  var questions = printedSurvey.getAllQuestions();
  for (var i = 0; i < questions.length; i++) {
    if (questions[i].getType() == "paneldynamic") {
      questions[i].renderMode = "list";
    }
  }

  renderSurveyFunction(printedSurvey, printedSurveyElement);
  // printedSurvey.render();
  return printedSurvey;
}
function showPrintedSurvey(survey, el, width, height, renderSurveyFunction) {
  createSurveyWithPrintedPages(survey, el, width, height, renderSurveyFunction);
}

var formats = [
  {
    name: "letter",
    width: 612,
    height: 792
  },
  {
    name: "a5",
    width: 420,
    height: 595
  },
  {
    name: "a4",
    width: 595,
    height: 842
  },
  {
    name: "a3",
    width: 842,
    height: 1191
  }
];

function saveSurveyToPdf(
  fileNameOrOptions,
  survey,
  width,
  height,
  renderSurveyFunction,
  formatName
) {
  var fileName = null;

  if (typeof fileNameOrOptions === "string") {
    fileName = fileNameOrOptions;
  } else {
    fileName = fileNameOrOptions.fileName;
    survey = fileNameOrOptions.survey;
    width = fileNameOrOptions.width;
    height = fileNameOrOptions.height;
    renderSurveyFunction = fileNameOrOptions.renderSurveyFunction;
    formatName = fileNameOrOptions.formatName;
  }

  if (formatName) {
    width = formats[formatName].width;
    height = formats[formatName].height;
  }

  var printedSurveyDiv = document.createElement("div");
  var invisibleDiv = document.createElement("div");
  invisibleDiv.appendChild(printedSurveyDiv);
  document.body.appendChild(invisibleDiv);

  printedSurveyDiv.className = "printed-survey-div";
  showPrintedSurvey(
    survey,
    printedSurveyDiv,
    width,
    height,
    renderSurveyFunction
  );

  invisibleDiv.style.position = "absolute";
  invisibleDiv.style.opacity = 0;
  setTimeout(function() {
    var elementsByPages = printedSurveyDiv.getElementsByClassName(
      pdfPrintedPageBreak
    );
    if (!elementsByPages || elementsByPages.length == 0) return;
    var currentElement = 0;
    var doc = new jsPDF("p", "pt");
    doc.internal.scaleFactor = 2.25;
    var margin = { left: 0, top: 0 };
    var options = {
      pagesplit: false,
      useOverflow: true,
      background: "#ffffff"
    };
    var renderSurveyToPdf = function() {
      doc.addHTML(
        elementsByPages[currentElement],
        margin.left,
        margin.top,
        options,
        function() {
          if (currentElement < elementsByPages.length - 1) {
            currentElement++;
            doc.addPage(width, height);
            renderSurveyToPdf();
          } else {
            doc.save(fileName);
            document.body.removeChild(invisibleDiv);
          }
        }
      );
    };
    renderSurveyToPdf();
  }, 100);
}
