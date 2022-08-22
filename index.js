const fs = require("fs");
const WebVTTParser = require("webvtt-parser").WebVTTParser;
const parser = new WebVTTParser();
const splitter = require("sentence-splitter");

const argv = require('yargs')
      .option('split-by-slide-id', {
        describe: 'Wrap transcript in <div>s (or markup provided with the --wrap-markup- options) each time the WebVTT file includes a cue with an id of the form slide-N',
      })
      .option('wrap-markup-start', {
        describe: "when --split-by-slide-id is set, this defines the markup used to mark the start of a section in the split, with ### replaced with the slide id",
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
    sentence = sentence.replace(/^going to slide \w+\.?$/i, '');
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
let section = [];
let sentencesCursor = 0;
const cueSections = [];
cues.forEach(c => {
  if (c.id.startsWith("slide-")) {
    if (section?.length) {
      cueSections.push(section);
    }
    section = [];
  }
  if (section) {
    section.push(c);
  }
});
if (section?.length) cueSections.push(section);
for (let section of cueSections) {
  const sentences = splitter.split(section.map(c => c.text).join(' '))
	.map(s => s.raw.trim()).filter(s => s);
  divs.push(sentences.map(cleanSentence));
}
let content = "";
if (argv["split-by-slide-id"]) {
  for (let i = 0 ; i < divs.length; i++) {
    content += argv["wrap-markup-start"].replace(/###/g, i+1);
    content += "<p>" + divs[i].join("</p>\n<p>") + "</p>";
    content += argv["wrap-markup-end"] + "\n\n";
  }
} else {
  content = "<p>" + divs.flat().flat().join("</p>\n\n<p>") + "</p>";
}

console.log(content);

