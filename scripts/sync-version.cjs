const fs = require('fs')
const v = process.env.npm_package_version
if (!v) process.exit(1)
let s = ''
try { s = fs.readFileSync('.env', 'utf8') } catch (e) {}
const lines = s.split('\n').filter(l => l && !l.startsWith('APP_VERSION='))
lines.unshift('APP_VERSION=' + v)
fs.writeFileSync('.env', lines.join('\n') + '\n')
