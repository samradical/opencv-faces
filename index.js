const Q = require('bluebird')
const { ExtractFrames, FaceFromClip } = require('./lib/video-frames-faces')
const GroupScenes = require('./lib/group-scenes')
const CutScene = require('./lib/cut-scenes')
const _ = require('lodash');

function groupAndCut(frames, options) {
  if (!frames) return null
  return GroupScenes(frames)
    .then(scenes => {
      return CutScene(scenes, options)
        .then(videoScenes => {

          const s = scenes.map((faces, i) => ({
            videoSrc: videoScenes[i],
            faces: faces
          }))
          return s
        })
    })
}

const GetFacesFromClip = (videoPath, options = { doBackgrounds: true }) => {

  return FaceFromClip(videoPath)
    .then(allFrames => {
      const { doBackgrounds } = options
      return Q.all([
        groupAndCut(allFrames.filter(frame => (frame.partOfFaceGroup)), { name: "faces" }),
        (doBackgrounds ? groupAndCut(allFrames.filter(frame => (!frame.partOfFaceGroup)), { name: "background" }) : null),
      ], { concurrency: 1 })

    })

}


module.exports = GetFacesFromClip
