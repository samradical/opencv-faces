const Q = require('bluebird')
const path = require('path')
const spawn = require('child_process').spawnSync
const colors = require('colors');
const _ = require('lodash');

const DISS_FUDGE = 40

const cutScene = (scene, i, options) => {
  return new Q((yes, no) => {

    const firstFrame = scene[0]
    const lastFrame = scene[scene.length - 1]

    const { videoPath, startTime } = firstFrame
    const { endTime } = lastFrame

    const duration = endTime-startTime

    const { name, dir, ext } = path.parse(videoPath)

    const output = `${dir}/${name}_${i}_${options.name}${ext}`

    console.log(colors.green(`Saving ${output} ${startTime} ${duration}`));

    const child = spawn(`ffmpeg`, [
      `-ss`,
      `${startTime}`,
      `-i`,
      `${videoPath}`,
      `-t`,
      `${duration}`,
      `-c:v`,
      `copy`,
      `-c:a`,
      `copy`,
      `-y`, output
    ])

    const stderr = child.stderr.toString('utf-8');
    const stdout = child.stdout.toString('utf-8');

    yes(output)

  });
}

const CutScenes = (scenes, options = {name:""}) => {
  return Q.map(scenes, (scene, i) => {
    return cutScene(scene, i, options)
  }, { concurrency: 1 })
}

module.exports = CutScenes
