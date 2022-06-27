const path = require('path')

module.exports = {
  entry: './build/index.js',
  target: 'web',
  mode: 'development',
  output: {
    path: path.join(__dirname, 'public/js'),
    filename: 'text-annotator.min.js',
    library: 'TextAnnotator'
  }
}
