const path = require('path')

module.exports = {
  entry: './dist/index.js',
  target: 'web',
  mode: 'production',
  output: {
    path: path.join(__dirname, 'public/js'),
    filename: 'text-annotator.min.js',
    library: 'TextAnnotator'
  }
}
