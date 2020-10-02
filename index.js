const fs = require("fs");
const WebVTTParser = require("webvtt-parser").WebVTTParser;
const parser = new WebVTTParser();
const splitter = require("sentence-splitter");

const argv = require('yargs')
      .option('split-by-slide-id', {
        describe: 'Wrap transcript in <div>s (or markup provided with the --wrap-markup- options) each time the WebVTT file includes a cue with an id of the form slide-N',
      })
      .option('wrap-markup-start', {
        describe: "when --split-by-slide-id is set, this defines the markup used to mark the start of a section in the split",
        default: "<div>"
      })
      .option('wrap-markup-end', {
        describe: "when --split-by-slide-id is set, this defines the markup used to mark the end of a section in the split",
        default: "</div>"
      })
      .option('clean-spoken-en', {
        describe: 'Remove spoken language marker that makes it harder to read a transcript (e.g. ", you know,")',
        default: false,
        type: 'boolean'
        })
        .option('input', {
          alias: 'i',
          describe: 'path to the input WebVTT file'
        })
        .demandOption(['input'], '')
        .check(argv =>  {
          if (!fs.statSync(argv["input"])) {
            throw new Error("File " + argv["input"] + " does not exist");
          }
          return true;
        })
        .help()
        .argv;

function cleanSentence(sentence) {
  if (argv["clean-spoken-en"]) {
    sentence = sentence.replace(/^slide [a-z0-9]*\.?/i, '');
    sentence = sentence.replace(/^next slide\.?/i, '');
    sentence = sentence.replace(/^next page\.?/i, '');
    sentence = sentence.replace(/^moving to next slide\.?/i, '');
    sentence = sentence.replace(/^moving to next page\.?/i, '');
    sentence = sentence.replace(/, you know, ?/g, ' ');
  }
  return sentence;
}

let cues;
try {
  ({cues} = parser.parse(fs.readFileSync(argv["input"], 'utf-8')));
} catch (e) {
  console.error("Could not parse " + argv["input"] + " as WebVTT: " + e);
  process.exit(1);
}
cues.forEach(c => c.text = c.text.replace(/<v [^>]*>/, '').replace(/<\/v>/, '')
             .replace('"',''));
if (argv["clean-spoken-en"]) {
  cues.forEach(c => c.text = c.text.replace(/^slide [0-9]+$/i, ''));
}
const sentences = splitter.split(cues.map(c => c.text).join(' '))
      .map(s => s.raw.trim()).filter(s => s);
const divs = [];
let div = [];
let sentencesCursor = 0;
let slideNum = 2;
cues.forEach(c => {
  if (c.id.startsWith("slide-" + slideNum)) {
    divs.push(div);
    div = [];
  } else {
    return;
  }
  while (sentencesCursor < sentences.length) {
    const sentence = sentences[sentencesCursor];
    if (sentence.startsWith(c.text.split('.')[0])) {
      break;
    }
      if (!sentence.match(/^slide [a-z0-9]+\.?$/i)) {
        div.push(cleanSentence(sentence));
      }
    sentencesCursor++;
    }
  slideNum++;
});
// dealing with last slide
divs.push(div);
div = [];
while (sentencesCursor < sentences.length) {
  let sentence = sentences[sentencesCursor];
  if (!sentence.match(/^slide [a-z0-9]*\.?$/i)) {
    div.push(cleanSentence(sentence));
  }
  sentencesCursor++;
}
divs.push(div);
let content;
if (argv["split-by-slide-id"]) {
  for (let i = 1 ; i < divs.length; i++) {
    content += argv["wrap-markup-start"];
    content += "<p>" + divs[i].join("</p>\n<p>") + "</p>";
    content += argv["wrap-markup-end"] + "\n\n";
  }
} else {
  content = "<p>" + divs.flat().flat().join("</p>\n\n<p>") + "</p>";
}

console.log(content);

