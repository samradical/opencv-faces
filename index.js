const Q = require('bluebird')
const { ExtractFrames, FaceFromClip,FacesFromVideo } = require('./lib/video-frames-faces')
const GroupScenes = require('./lib/group-scenes')
const CutScene = require('./lib/cut-scenes')
const _ = require('lodash');


const DEFAULT = {
  dissimilartyFudge: .4,
  minSecondsBetweenScenes: 1,
}

function groupAndCut(frames, options) {
  if (!frames) return null
  return GroupScenes(frames, options)
    .then(scenes => {

      let newScenes = []
      let active = []

      /*PUSH INTO ACTIVE ARR */

      /*let i = 0
      while (i < scenes.length) {
        const scene = scenes[i]
        const next = scenes[i + 1]
        if (!next) {
          active = []
          active.push(scene)
          newScenes.push(active)
          i++
        } else {
          active = active || []
          const { startTime } = next[0]
          const { endTime } = scene[i]
          console.log(startTime, endTime, options.minSecondsBetweenScenes);
          if (endTime - startTime < options.minSecondsBetweenScenes) {
            active
            newScenes.push(_.flatten([...scene, ...next]))
            i += 2
          } else {
            newScenes.push(scene)
          }
        }

      }

      for (var i = 0; i < scenes.length; i += 2) {
        console.log("i", i);
        const scene = scenes[i]
        if (!next) {
          newScenes.push(scene)
        } else {
          const { startTime } = next[0]
          const { endTime } = _.last(scene)
          console.log(startTime, endTime, options.minSecondsBetweenScenes);
          if (endTime - startTime < options.minSecondsBetweenScenes) {
            newScenes.push(_.flatten([...scene, ...next]))
            i += 2
          } else {
            newScenes.push(scene)
          }
        }
      }

      console.log(newScenes);

      console.log("---------");
      console.log("---------");*/

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

const AnalyzeVideo = (videoPath, options = {})=>{

}


const GetFacesFromClip = (videoPath, options = { doBackgrounds: false }) => {

  return FaceFromClip(videoPath, options)
    .then(allFrames => {
      const { doBackgrounds } = options
      return Q.all([
          groupAndCut(allFrames.filter(frame => (frame.partOfFaceGroup)), _.assign({},DEFAULT, options, { name: "faces" })),
          (doBackgrounds ? groupAndCut(allFrames.filter(frame => (!frame.partOfFaceGroup)), _.assign({},DEFAULT, options, { name: "background" })) : null),
        ], { concurrency: 1 })
        .then(results => (_.compact(_.flatten(results))))

    })

}




module.exports = {GetFacesFromClip, FacesFromVideo}
