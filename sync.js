require('dotenv').config()
const textAnnotatorProjectDir = process.env.textAnnotatorProjectDir
const textAnnotatorModuleDir = process.env.textAnnotatorModuleDir
// change it to false if you do not want watcher
const watch = process.env.watch

const exclude = [/node_modules/, /\.git/]

const fs = require('fs')
if (
  fs.existsSync(textAnnotatorProjectDir) &&
  fs.existsSync(textAnnotatorModuleDir)
) {
  // eslint-disable-next-line
  console.log('watcher started')
  require('sync-directory')(textAnnotatorProjectDir, textAnnotatorModuleDir, {
    cb: () => {
      // eslint-disable-next-line
      console.log('text-annotator sync done')
    },
    exclude,
    watch
  })
} else {
  // eslint-disable-next-line
  console.log(
    'either textAnnotatorProjectDir or textAnnotatorModuleDir does not exist'
  )
}
