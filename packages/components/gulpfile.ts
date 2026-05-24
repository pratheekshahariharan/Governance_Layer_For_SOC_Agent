const { src, dest, parallel } = require('gulp')

function copyIcons() {
    return src(['nodes/**/*.{jpg,png,svg}']).pipe(dest('dist/nodes'))
}

function copyGovernance() {
    return src(['governance/**/*.yaml']).pipe(dest('dist/governance'))
}

exports.default = parallel(copyIcons, copyGovernance)
