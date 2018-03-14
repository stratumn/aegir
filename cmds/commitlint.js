'use strict'

const lint = require('@commitlint/lint')
const read = require('@commitlint/read')
const load = require('@commitlint/load')
const util = require('util')

function exec (command) {
  return new Promise((resolve, reject) => {
    require('child_process').exec(command, (err, stdout, stderr) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(stdout)
      }
    })
  })
}

function runLinter () {
  return exec('git rev-parse --abbrev-ref HEAD')
    .then((branch) => exec(`git rev-list --left-right --count master...${branch}`))
    .then((count) => count.split(/\s+/)[1])
    .then((commits) => read({to: 'HEAD', from: `HEAD~${commits}`}))
    .then((commits) => Promise.all([commits, load({ extends: ['@commitlint/config-conventional'] })]))
    .then(([commits, opts]) => Promise.all(commits.map((commit) => lint(
      commit,
      opts.rules,
      opts.parserPreset ? {parserOpts: opts.parserPreset.parserOpts} : {}
    ))))
    .then(results => results.filter((r) => !r.valid))
    .then(invalid => {
      if (invalid.length) {
        console.log(util.inspect(invalid, false, null))
        return 1
      } else {
        return 0
      }
    })
    .then(process.exit)
    .catch((error) => {
      console.log(error)
      process.exit(1)
    })
}

function checkOutAndLint () {
  return exec('git config remote.origin.fetch +refs/heads/*:refs/remotes/origin/*')
    .then(() => exec('git fetch'))
    .then(() => exec('git rev-parse --abbrev-ref HEAD'))
    .then((branch) => exec(`git checkout master`).then(() => branch))
    .then(runLinter)
    .catch((error) => {
      console.log(error)
      process.exit(1)
    })
}

exec('git rev-parse --verify master')
  .then(runLinter)
  .catch(checkOutAndLint) // In case of failure, check out 'master' from remote.
