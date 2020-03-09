require('dotenv').config()
const textHighlightProjectDir = process.env.textHighlightProjectDir
const textHighlightModuleDir = process.env.textHighlightModuleDir
// change it to false if you do not want watcher
const watch = process.env.watch

const exclude = [/node_modules/, /\.git/]

const fs = require('fs')
if (
  fs.existsSync(textHighlightProjectDir) &&
  fs.existsSync(textHighlightModuleDir)
) {
  // eslint-disable-next-line
  console.log('watcher started')
  require('sync-directory')(textHighlightProjectDir, textHighlightModuleDir, {
    cb: () => {
      // eslint-disable-next-line
      console.log('text-highlight sync done')
    },
    exclude,
    watch
  })
} else {
  // eslint-disable-next-line
  console.log(
    'either textHighlightProjectDir or textHighlightModuleDir does not exist'
  )
}
