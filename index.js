const fs = require("fs");
const WebVTTParser = require("webvtt-parser").WebVTTParser;
const parser = new WebVTTParser();
const splitter = require("sentence-splitter");

if (process.argv.length !== 3) {
  console.error("Takes one argument (path to a WebVTT file)");
  process.exit(1);
}
const {cues} = parser.parse(fs.readFileSync(process.argv[2], 'utf-8'));

const sentences = splitter.split(cues.map(c => c.text).join(' '))
      .map(s => s.raw.trim()).filter(s => s);

console.log("<p>" +
            sentences.join('</p>\n\n<p>')
            + "</p>");

